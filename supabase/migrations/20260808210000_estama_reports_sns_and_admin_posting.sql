-- エステ魂の日次レポート、魂セラピストの連携情報、管理者の3媒体同時投稿を追加する。

create table if not exists public.external_daily_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider in ('estama')),
  external_store_id text not null,
  report_date date not null,
  page_views integer not null default 0 check (page_views >= 0),
  inquiry_count integer not null default 0 check (inquiry_count >= 0),
  source_message_id text,
  source_subject text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider, report_date)
);

create unique index if not exists external_daily_reports_source_message_key
  on public.external_daily_reports(provider, source_message_id)
  where source_message_id is not null;

create index if not exists external_daily_reports_store_date_idx
  on public.external_daily_reports(store_id, report_date desc);

alter table public.external_daily_reports enable row level security;

drop policy if exists external_daily_reports_store_managers_read
  on public.external_daily_reports;
create policy external_daily_reports_store_managers_read
  on public.external_daily_reports
  for select
  to authenticated
  using ((select public.can_manage_store(store_id)));

revoke all on table public.external_daily_reports from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.external_daily_reports from authenticated;
grant select on table public.external_daily_reports to authenticated;
grant all on table public.external_daily_reports to service_role;

create or replace function public.get_sns_connection_overview_v3(p_store_id uuid)
returns table(
  cast_id uuid,
  cast_name text,
  photo text,
  o2_created boolean,
  o2_linkage_requested boolean,
  profile_url text,
  credential_configured boolean,
  login_id text,
  x_profile_url text,
  x_credential_configured boolean,
  x_login_id text,
  estama_profile_url text,
  estama_credential_configured boolean,
  estama_login_id text,
  last_o2_status text,
  last_o2_error text,
  last_posted_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  return query
  select c.id,
         c.name,
         c.photo,
         coalesce(c.o2_created, false),
         coalesce(c.o2_linkage_requested, false),
         c.o2_url,
         o2_credentials.login_id is not null and o2_credentials.password is not null,
         o2_credentials.login_id,
         case
           when nullif(trim(c.x_account), '') is null then null
           when c.x_account ~* '^https://' then c.x_account
           else 'https://x.com/' || regexp_replace(trim(c.x_account), '^@', '')
         end,
         x_credentials.login_id is not null and x_credentials.password is not null,
         x_credentials.login_id,
         c.estama_profile_url,
         estama_credentials.login_id is not null and estama_credentials.password is not null,
         estama_credentials.login_id,
         latest.o2_status,
         latest.o2_error,
         latest.created_at
  from public.casts c
  left join public.cast_site_credentials o2_credentials
    on o2_credentials.cast_id = c.id
   and o2_credentials.store_id = p_store_id
   and o2_credentials.site = 'o2'
  left join public.cast_site_credentials x_credentials
    on x_credentials.cast_id = c.id
   and x_credentials.store_id = p_store_id
   and x_credentials.site = 'x'
  left join public.cast_site_credentials estama_credentials
    on estama_credentials.cast_id = c.id
   and estama_credentials.store_id = p_store_id
   and estama_credentials.site = 'esutama'
  left join lateral (
    select p.o2_status, p.o2_error, p.created_at
    from public.cast_posts p
    where p.cast_id = c.id
      and p.store_id = p_store_id
    order by p.created_at desc
    limit 1
  ) latest on true
  where c.store_id = p_store_id
  order by c.display_order nulls last, c.name;
end;
$$;

create or replace function public.save_sns_connection_admin_v3(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_x_login_id text,
  p_x_password text,
  p_estama_login_id text,
  p_estama_password text,
  p_estama_profile_url text,
  p_o2_created boolean,
  p_o2_linkage_requested boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_login_id text := nullif(trim(coalesce(p_login_id, '')), '');
  v_password text := nullif(coalesce(p_password, ''), '');
  v_x_login_id text := nullif(trim(coalesce(p_x_login_id, '')), '');
  v_x_password text := nullif(coalesce(p_x_password, ''), '');
  v_estama_login_id text := nullif(trim(coalesce(p_estama_login_id, '')), '');
  v_estama_password text := nullif(coalesce(p_estama_password, ''), '');
  v_estama_profile_url text := nullif(trim(coalesce(p_estama_profile_url, '')), '');
  v_profile_url text;
  v_x_profile_url text;
  v_has_o2_credential boolean;
  v_has_x_credential boolean;
  v_has_estama_credential boolean;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  if not exists (
    select 1 from public.casts c
    where c.id = p_cast_id and c.store_id = p_store_id
  ) then
    raise exception '対象セラピストが見つかりません';
  end if;

  if v_login_id is not null then
    v_login_id := regexp_replace(v_login_id, '^https?://(www\.)?m-sns\.net/profile/', '', 'i');
    v_login_id := regexp_replace(v_login_id, '^@', '');
  end if;
  if v_x_login_id is not null then
    v_x_login_id := regexp_replace(v_x_login_id, '^https?://(www\.)?(x|twitter)\.com/', '', 'i');
    v_x_login_id := regexp_replace(v_x_login_id, '^@', '');
  end if;

  if v_login_id is not null and v_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'O2のIDは半角英数字とアンダーバーで入力してください';
  end if;
  if v_x_login_id is not null and v_x_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'XのIDは半角英数字とアンダーバーで入力してください';
  end if;
  if length(coalesce(v_login_id, '')) > 255
     or length(coalesce(v_x_login_id, '')) > 255
     or length(coalesce(v_estama_login_id, '')) > 255 then
    raise exception 'IDは255文字以内で入力してください';
  end if;
  if length(coalesce(v_password, '')) > 512
     or length(coalesce(v_x_password, '')) > 512
     or length(coalesce(v_estama_password, '')) > 512 then
    raise exception 'パスワードは512文字以内で入力してください';
  end if;
  if length(coalesce(v_estama_profile_url, '')) > 2048 then
    raise exception 'プロフィールURLは2048文字以内で入力してください';
  end if;
  if v_estama_profile_url is not null and v_estama_profile_url !~* '^https://(www\.)?estama\.jp/' then
    raise exception '魂セラピストのプロフィールURLを入力してください';
  end if;
  if v_login_id is null and v_password is not null then
    raise exception 'O2のIDを入力してください';
  end if;
  if v_x_login_id is null and v_x_password is not null then
    raise exception 'XのIDを入力してください';
  end if;
  if v_estama_login_id is null and v_estama_password is not null then
    raise exception '魂セラピストのIDを入力してください';
  end if;

  select exists (
    select 1 from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'o2'
  ) into v_has_o2_credential;
  select exists (
    select 1 from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'x'
  ) into v_has_x_credential;
  select exists (
    select 1 from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'esutama'
  ) into v_has_estama_credential;

  if v_login_id is not null and not v_has_o2_credential and v_password is null then
    raise exception 'O2の初回設定ではパスワードも入力してください';
  end if;
  if v_x_login_id is not null and not v_has_x_credential and v_x_password is null then
    raise exception 'Xの初回設定ではパスワードも入力してください';
  end if;
  if v_estama_login_id is not null and not v_has_estama_credential and v_estama_password is null then
    raise exception '魂セラピストの初回設定ではパスワードも入力してください';
  end if;

  v_profile_url := case when v_login_id is null then null else 'https://m-sns.net/profile/@' || v_login_id end;
  v_x_profile_url := case when v_x_login_id is null then null else 'https://x.com/' || v_x_login_id end;

  update public.casts
  set o2_created = coalesce(p_o2_created, false),
      o2_linkage_requested = coalesce(p_o2_linkage_requested, false),
      o2_url = v_profile_url,
      x_account = v_x_profile_url,
      estama_profile_url = v_estama_profile_url
  where id = p_cast_id and store_id = p_store_id;

  if v_login_id is null then
    delete from public.cast_site_credentials
    where cast_id = p_cast_id and store_id = p_store_id and site = 'o2';
  elsif v_has_o2_credential then
    update public.cast_site_credentials
    set login_id = v_login_id,
        password = coalesce(v_password, password),
        updated_at = now()
    where cast_id = p_cast_id and store_id = p_store_id and site = 'o2';
  else
    insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password, updated_at)
    values (p_cast_id, p_store_id, 'o2', v_login_id, v_password, now());
  end if;

  if v_x_login_id is null then
    delete from public.cast_site_credentials
    where cast_id = p_cast_id and store_id = p_store_id and site = 'x';
  elsif v_has_x_credential then
    update public.cast_site_credentials
    set login_id = v_x_login_id,
        password = coalesce(v_x_password, password),
        updated_at = now()
    where cast_id = p_cast_id and store_id = p_store_id and site = 'x';
  else
    insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password, updated_at)
    values (p_cast_id, p_store_id, 'x', v_x_login_id, v_x_password, now());
  end if;

  if v_estama_login_id is null then
    delete from public.cast_site_credentials
    where cast_id = p_cast_id and store_id = p_store_id and site = 'esutama';
  elsif v_has_estama_credential then
    update public.cast_site_credentials
    set login_id = v_estama_login_id,
        password = coalesce(v_estama_password, password),
        updated_at = now()
    where cast_id = p_cast_id and store_id = p_store_id and site = 'esutama';
  else
    insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password, updated_at)
    values (p_cast_id, p_store_id, 'esutama', v_estama_login_id, v_estama_password, now());
  end if;
end;
$$;

create or replace function public.create_admin_multi_post(
  p_store_id uuid,
  p_cast_id uuid,
  p_title text,
  p_body text,
  p_image_urls text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;
  if not exists (
    select 1 from public.casts c
    where c.id = p_cast_id and c.store_id = p_store_id
  ) then
    raise exception '対象セラピストが見つかりません';
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
    p_cast_id, p_store_id, v_title, v_body, p_image_urls, 'pending',
    'posted', 'pending', 'pending'
  )
  returning id into v_post_id;

  insert into public.cast_diaries (
    cast_id, title, category, image_url, image_urls, body, posted_at,
    external_url, display_order, source_post_id
  ) values (
    p_cast_id, v_title, '写メ日記', p_image_urls[1], p_image_urls, v_body, now(),
    null, -extract(epoch from clock_timestamp())::integer, v_post_id
  );

  return v_post_id;
end;
$$;

revoke all on function public.get_sns_connection_overview_v3(uuid) from public, anon;
revoke all on function public.save_sns_connection_admin_v3(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean) from public, anon;
revoke all on function public.create_admin_multi_post(uuid, uuid, text, text, text[]) from public, anon;
grant execute on function public.get_sns_connection_overview_v3(uuid) to authenticated;
grant execute on function public.save_sns_connection_admin_v3(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.create_admin_multi_post(uuid, uuid, text, text, text[]) to authenticated;
