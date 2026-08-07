-- エスたまの同期可能期間（当日を含む14日間）をDB側でも保証し、
-- セラピストポータルの3媒体投稿をアクセストークン経由の安全なRPCへ移す。

create table if not exists public.cast_diaries (
  id uuid primary key default gen_random_uuid(),
  cast_id uuid not null references public.casts(id) on delete cascade,
  title text,
  category text,
  image_url text,
  image_urls text[],
  body text not null,
  posted_at timestamptz not null default now(),
  external_url text,
  display_order integer not null default 0,
  fetched_at timestamptz not null default now()
);

alter table public.cast_diaries enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cast_diaries' and policyname = 'cast_diaries_public_read'
  ) then
    create policy cast_diaries_public_read on public.cast_diaries for select using (true);
  end if;
end;
$$;
grant select on table public.cast_diaries to anon, authenticated;

alter table public.cast_posts
  add column if not exists hp_status text not null default 'posted',
  add column if not exists hp_error text,
  add column if not exists o2_attempts integer not null default 0,
  add column if not exists esutama_attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

alter table public.automation_jobs drop constraint if exists automation_jobs_job_type_check;
alter table public.automation_jobs add constraint automation_jobs_job_type_check
  check (job_type in ('estama_register_cast', 'estama_sync_shift', 'estama_reconcile_shifts', 'estama_post_diary'));

alter table public.cast_diaries
  add column if not exists source_post_id uuid references public.cast_posts(id) on delete cascade,
  add column if not exists image_urls text[];

create unique index if not exists cast_diaries_source_post_id_key
  on public.cast_diaries(source_post_id)
  where source_post_id is not null;

-- 旧カラムのO2認証情報は、RLS対象の認証情報テーブルへ一度だけ退避する。
insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password)
select c.id, c.store_id, 'o2', c.o2_login_id, c.o2_login_password
from public.casts c
where nullif(trim(c.o2_login_id), '') is not null
  and nullif(trim(c.o2_login_password), '') is not null
on conflict (cast_id, site) do nothing;

update public.casts
set o2_login_password = null
where o2_login_password is not null;

-- 匿名ユーザーが投稿や外部サイト認証情報を直接読み書きできた旧ポリシーを閉じる。
drop policy if exists open_all_cast_posts on public.cast_posts;
drop policy if exists open_all_cast_site_credentials on public.cast_site_credentials;
revoke all on table public.cast_posts from anon;
revoke all on table public.cast_site_credentials from anon;

drop policy if exists cast_posts_store_managers on public.cast_posts;
create policy cast_posts_store_managers on public.cast_posts
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists cast_site_credentials_store_managers_read on public.cast_site_credentials;
create policy cast_site_credentials_store_managers_read on public.cast_site_credentials
  for select to authenticated
  using (public.can_manage_store(store_id));

-- 公開プロフィールでは必要な列だけを匿名公開し、ポータル用トークンと旧PW列は除外する。
revoke select on table public.casts from anon;
revoke insert, update, delete, truncate, references, trigger on table public.casts from anon;
do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'casts'
    and column_name not in ('access_token', 'o2_login_password');

  execute 'grant select (' || v_columns || ') on public.casts to anon';
end;
$$;

create or replace function public.get_therapist_post_connections(p_token text)
returns table(site text, configured boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
begin
  select c.id into v_cast_id
  from public.casts c
  where c.access_token = p_token;

  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;

  return query
  select 'o2'::text,
         exists (
           select 1 from public.cast_site_credentials credentials
           where credentials.cast_id = v_cast_id
             and credentials.site = 'o2'
             and nullif(trim(credentials.login_id), '') is not null
             and nullif(trim(credentials.password), '') is not null
         )
  union all
  select 'esutama'::text,
         exists (
           select 1
           from public.external_cast_profiles profile
           join public.automation_connections connection
             on connection.store_id = profile.store_id
            and connection.provider = 'estama'
            and connection.status = 'ready'
           where profile.cast_id = v_cast_id
             and profile.provider = 'estama'
             and profile.sync_status = 'synced'
         );
end;
$$;

create or replace function public.get_therapist_posts_secure(p_token text)
returns table(
  id uuid,
  title text,
  body text,
  image_urls text[],
  status text,
  hp_status text,
  o2_status text,
  esutama_status text,
  hp_error text,
  o2_error text,
  esutama_error text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
begin
  select c.id into v_cast_id
  from public.casts c
  where c.access_token = p_token;

  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;

  return query
  select p.id, p.title, p.body, p.image_urls, p.status,
         p.hp_status, p.o2_status, p.esutama_status,
         p.hp_error, p.o2_error, p.esutama_error, p.created_at
  from public.cast_posts p
  where p.cast_id = v_cast_id
  order by p.created_at desc
  limit 30;
end;
$$;

create or replace function public.create_therapist_post(
  p_token text,
  p_title text,
  p_body text,
  p_image_urls text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_post_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
begin
  select c.id, c.store_id into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token;

  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;
  if v_body = '' then
    raise exception '本文を入力してください';
  end if;
  if length(v_body) > 5000 then
    raise exception '本文は5000文字以内で入力してください';
  end if;
  if v_title is not null and length(v_title) > 120 then
    raise exception 'タイトルは120文字以内で入力してください';
  end if;
  if coalesce(array_length(p_image_urls, 1), 0) > 3 then
    raise exception '画像は3枚までです';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_image_urls, array[]::text[])) image_url
    where image_url !~ '^https://'
  ) then
    raise exception '画像URLが不正です';
  end if;

  insert into public.cast_posts (
    cast_id, store_id, title, body, image_urls, status,
    hp_status, o2_status, esutama_status
  ) values (
    v_cast_id, v_store_id, v_title, v_body, p_image_urls, 'pending',
    'posted', 'pending', 'pending'
  )
  returning id into v_post_id;

  insert into public.cast_diaries (
    cast_id, title, category, image_url, image_urls, body, posted_at,
    external_url, display_order, source_post_id
  ) values (
    v_cast_id, v_title, '写メ日記', p_image_urls[1], p_image_urls, v_body, now(),
    null, -extract(epoch from clock_timestamp())::integer, v_post_id
  );

  return v_post_id;
end;
$$;

create or replace function public.save_therapist_site_credential(
  p_token text,
  p_site text,
  p_login_id text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
begin
  if p_site <> 'o2' then
    raise exception 'ポータルで設定できる媒体はO2のみです';
  end if;
  if nullif(trim(p_login_id), '') is null or nullif(p_password, '') is null then
    raise exception 'ログインIDとパスワードを入力してください';
  end if;

  select c.id, c.store_id into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token;

  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;

  insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password)
  values (v_cast_id, v_store_id, p_site, trim(p_login_id), p_password)
  on conflict (cast_id, site) do update set
    login_id = excluded.login_id,
    password = excluded.password,
    store_id = excluded.store_id;
end;
$$;

create or replace function public.get_site_connection_status_admin(p_store_id uuid)
returns table(cast_id uuid, site text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  return query
  select credentials.cast_id, credentials.site
  from public.cast_site_credentials credentials
  where credentials.store_id = p_store_id
    and nullif(trim(credentials.login_id), '') is not null
    and nullif(trim(credentials.password), '') is not null;
end;
$$;

create or replace function public.get_o2_connection_overview(p_store_id uuid)
returns table(
  cast_id uuid,
  cast_name text,
  photo text,
  o2_created boolean,
  o2_linkage_requested boolean,
  o2_url text,
  credential_configured boolean,
  last_o2_status text,
  last_o2_error text,
  last_posted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  return query
  select c.id, c.name, c.photo,
         coalesce(c.o2_created, false), coalesce(c.o2_linkage_requested, false), c.o2_url,
         exists (
           select 1 from public.cast_site_credentials credentials
           where credentials.cast_id = c.id and credentials.site = 'o2'
             and nullif(trim(credentials.login_id), '') is not null
             and nullif(trim(credentials.password), '') is not null
         ),
         latest.o2_status, latest.o2_error, latest.created_at
  from public.casts c
  left join lateral (
    select p.o2_status, p.o2_error, p.created_at
    from public.cast_posts p
    where p.cast_id = c.id
    order by p.created_at desc
    limit 1
  ) latest on true
  where c.store_id = p_store_id
  order by c.display_order nulls last, c.name;
end;
$$;

drop function if exists public.save_o2_credential_admin(uuid, uuid, text, text);

create or replace function public.update_o2_linkage_admin(
  p_store_id uuid,
  p_cast_id uuid,
  p_o2_created boolean,
  p_o2_linkage_requested boolean,
  p_o2_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  update public.casts
  set o2_created = coalesce(p_o2_created, false),
      o2_linkage_requested = coalesce(p_o2_linkage_requested, false),
      o2_url = nullif(trim(coalesce(p_o2_url, '')), '')
  where id = p_cast_id and store_id = p_store_id;

  if not found then
    raise exception '対象セラピストが見つかりません';
  end if;
end;
$$;

revoke all on function public.get_therapist_post_connections(text) from public;
revoke all on function public.get_therapist_posts_secure(text) from public;
revoke all on function public.create_therapist_post(text, text, text, text[]) from public;
revoke all on function public.save_therapist_site_credential(text, text, text, text) from public;
revoke all on function public.get_site_connection_status_admin(uuid) from public, anon;
revoke all on function public.get_o2_connection_overview(uuid) from public, anon;
revoke all on function public.update_o2_linkage_admin(uuid, uuid, boolean, boolean, text) from public, anon;

grant execute on function public.get_therapist_post_connections(text) to anon, authenticated;
grant execute on function public.get_therapist_posts_secure(text) to anon, authenticated;
grant execute on function public.create_therapist_post(text, text, text, text[]) to anon, authenticated;
grant execute on function public.save_therapist_site_credential(text, text, text, text) to anon, authenticated;
grant execute on function public.get_site_connection_status_admin(uuid) to authenticated;
grant execute on function public.get_o2_connection_overview(uuid) to authenticated;
grant execute on function public.update_o2_linkage_admin(uuid, uuid, boolean, boolean, text) to authenticated;

-- 旧ポータルトークン管理RPCは管理画面専用。Supabaseの既定権限でanonへ
-- 付与されていたEXECUTEを明示的に取り消す。
revoke execute on function public.get_cast_access_tokens() from public, anon;
revoke execute on function public.set_cast_access_token(uuid, text) from public, anon;
grant execute on function public.get_cast_access_tokens() to authenticated;
grant execute on function public.set_cast_access_token(uuid, text) to authenticated;

-- シフト追加・変更時は日本時間の当日から13日後までだけをキューへ入れる。
create or replace function public.trg_enqueue_estama_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shifts%rowtype;
  v_action text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if tg_op = 'UPDATE'
     and new.cast_id is not distinct from old.cast_id
     and new.shift_date is not distinct from old.shift_date
     and new.start_time is not distinct from old.start_time
     and new.end_time is not distinct from old.end_time
     and new.status is not distinct from old.status
     and new.approval_status is not distinct from old.approval_status then
    return new;
  end if;

  -- 日付またはセラピストを変更した場合、変更前の枠が14日内なら先に削除ジョブを作る。
  if tg_op = 'UPDATE'
     and (new.shift_date is distinct from old.shift_date or new.cast_id is distinct from old.cast_id)
     and old.shift_date between v_today and v_today + 13
     and exists (
       select 1 from public.external_cast_profiles
       where cast_id = old.cast_id and provider = 'estama' and sync_status = 'synced'
     ) then
    perform public.enqueue_estama_job(
      old.store_id,
      'estama_sync_shift',
      old.cast_id,
      null,
      'estama:shift:old:' || old.id::text || ':' || old.shift_date::text,
      jsonb_build_object(
        'source', 'shift_update_old_value',
        'action', 'delete',
        'cast_id', old.cast_id,
        'shift_date', old.shift_date,
        'start_time', old.start_time,
        'end_time', old.end_time
      )
    );
  end if;

  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'delete';
  else
    v_row := new;
    v_action := case when new.approval_status = 'approved' and new.status <> 'cancelled' then 'upsert' else 'delete' end;
  end if;

  if v_row.shift_date < v_today or v_row.shift_date > v_today + 13 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.external_cast_profiles
    where cast_id = v_row.cast_id
      and provider = 'estama'
      and sync_status = 'synced'
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  perform public.enqueue_estama_job(
    v_row.store_id,
    'estama_sync_shift',
    v_row.cast_id,
    case when tg_op = 'DELETE' then null else v_row.id end,
    'estama:shift:' || v_row.id::text,
    jsonb_build_object(
      'source', 'shift_' || lower(tg_op),
      'action', v_action,
      'shift_id', v_row.id,
      'cast_id', v_row.cast_id,
      'shift_date', v_row.shift_date,
      'start_time', v_row.start_time,
      'end_time', v_row.end_time
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function public.trg_enqueue_estama_shift() from public, anon, authenticated;
revoke execute on function public.enqueue_estama_job(uuid, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.enqueue_estama_job(uuid, text, uuid, uuid, text, jsonb) to authenticated, service_role;

-- すでに範囲外で待機しているジョブがあれば失敗にせず完了扱いで止める。
update public.automation_jobs
set status = 'completed',
    error_message = null,
    result = jsonb_build_object(
      'skipped', true,
      'reason', 'outside_estama_window',
      'shift_date', payload->>'shift_date'
    ),
    finished_at = now()
where provider = 'estama'
  and job_type = 'estama_sync_shift'
  and status in ('queued', 'waiting_for_login')
  and payload ? 'shift_date'
  and (
    (payload->>'shift_date')::date < (now() at time zone 'Asia/Tokyo')::date
    or (payload->>'shift_date')::date > (now() at time zone 'Asia/Tokyo')::date + 13
  );

