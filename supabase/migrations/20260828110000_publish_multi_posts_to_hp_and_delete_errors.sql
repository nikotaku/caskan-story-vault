-- 同時投稿をHP写メ日記にも同期し、外部媒体の一部だけ失敗した履歴を
-- 管理画面から安全に削除できるようにする。

create or replace function public.create_therapist_post(
  p_token text,
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
  v_cast_id uuid;
  v_store_id uuid;
  v_post_id uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
  v_image_url text;
begin
  select c.id, c.store_id into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
    and c.is_active = true;

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
  if coalesce(cardinality(p_image_urls), 0) <> 1 then
    raise exception '画像は1枚必須です';
  end if;

  select trim(images.image_url)
    into v_image_url
  from unnest(p_image_urls) as images(image_url);

  if v_image_url is null
     or v_image_url = ''
     or v_image_url !~ '^https://[^[:space:]]+$' then
    raise exception '画像URLが不正です';
  end if;

  insert into public.cast_posts (
    cast_id, store_id, title, body, image_urls, status,
    hp_status, o2_status, esutama_status
  ) values (
    v_cast_id, v_store_id, v_title, v_body, array[v_image_url], 'pending',
    'posted', 'pending', 'pending'
  )
  returning id into v_post_id;

  insert into public.cast_diaries (
    cast_id, title, category, image_url, image_urls, body, posted_at,
    external_url, display_order, source_post_id
  ) values (
    v_cast_id, v_title, '写メ日記', v_image_url, array[v_image_url], v_body, now(),
    null, -extract(epoch from clock_timestamp())::integer, v_post_id
  );

  return v_post_id;
end;
$$;

drop function if exists public.create_admin_multi_post(uuid, uuid, text, text, text[]);

create function public.create_admin_multi_post(
  p_store_id uuid,
  p_cast_id uuid,
  p_title text,
  p_body text,
  p_image_urls text[] default null,
  p_publish_hp boolean default true
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
  v_image_url text;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;
  if not exists (
    select 1 from public.casts c
    where c.id = p_cast_id
      and c.store_id = p_store_id
      and c.is_active = true
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
  if coalesce(cardinality(p_image_urls), 0) <> 1 then
    raise exception '画像は1枚必須です';
  end if;

  select trim(images.image_url)
    into v_image_url
  from unnest(p_image_urls) as images(image_url);

  if v_image_url is null
     or v_image_url = ''
     or v_image_url !~ '^https://[^[:space:]]+$' then
    raise exception '画像URLが不正です';
  end if;

  insert into public.cast_posts (
    cast_id, store_id, title, body, image_urls, status,
    hp_status, o2_status, esutama_status
  ) values (
    p_cast_id, p_store_id, v_title, v_body, array[v_image_url], 'pending',
    case when coalesce(p_publish_hp, true) then 'posted' else 'skipped' end,
    'pending', 'pending'
  )
  returning id into v_post_id;

  if coalesce(p_publish_hp, true) then
    insert into public.cast_diaries (
      cast_id, title, category, image_url, image_urls, body, posted_at,
      external_url, display_order, source_post_id
    ) values (
      p_cast_id, v_title, '写メ日記', v_image_url, array[v_image_url], v_body, now(),
      null, -extract(epoch from clock_timestamp())::integer, v_post_id
    );
  end if;

  return v_post_id;
end;
$$;

revoke all on function public.create_therapist_post(text, text, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.create_admin_multi_post(uuid, uuid, text, text, text[], boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.create_therapist_post(text, text, text, text[])
  to anon, authenticated, service_role;
grant execute on function public.create_admin_multi_post(uuid, uuid, text, text, text[], boolean)
  to authenticated, service_role;

create or replace function public.delete_admin_failed_cast_post(p_post_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post public.cast_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into v_post
  from public.cast_posts
  where id = p_post_id;

  if not found then
    raise exception '削除対象の投稿が見つかりません';
  end if;
  if not public.can_manage_store(v_post.store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  -- 関連ジョブを先にロックし、削除判定中にワーカーが送信を開始するのを防ぐ。
  perform 1
  from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text
  for update;

  select * into v_post
  from public.cast_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception '削除対象の投稿が見つかりません';
  end if;
  if coalesce(v_post.esutama_error, '') like '【要確認・再送停止】%' then
    raise exception '魂セラピスト側の掲載有無を確認するまで、この投稿は削除できません';
  end if;
  if coalesce(v_post.o2_status, '') = 'posting'
    or coalesce(v_post.esutama_status, '') = 'posting'
    or exists (
      select 1
      from public.automation_jobs job
      where job.store_id = v_post.store_id
        and job.job_type = 'estama_post_diary'
        and job.payload->>'post_id' = p_post_id::text
        and job.status = 'running'
    ) then
    raise exception '送信処理中のため削除できません。完了後にもう一度お試しください';
  end if;
  if not (
    v_post.status = 'failed'
    or coalesce(v_post.o2_status, '') in ('failed', 'skipped')
    or coalesce(v_post.esutama_status, '') in ('failed', 'skipped')
    or v_post.o2_error is not null
    or v_post.esutama_error is not null
  ) then
    raise exception '送信エラーのない投稿は削除できません';
  end if;

  delete from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text;

  -- source_post_id の外部キーにより、対応するHP写メ日記も同時に削除される。
  -- O2・魂セラピスト上の外部投稿はこのDB削除の対象外。
  delete from public.cast_posts
  where id = p_post_id;

  return true;
end;
$$;

revoke all on function public.delete_admin_failed_cast_post(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_admin_failed_cast_post(uuid)
  to authenticated;

-- 直前に正常完了した新仕様（600x600・1枚）の投稿だけをHPへ反映する。
-- 失敗投稿・テスト途中・旧複数画像投稿は遡って公開しない。
with eligible as (
  select p.id, p.cast_id, p.title, p.body, p.image_urls, p.created_at
  from public.cast_posts p
  join public.casts c on c.id = p.cast_id and c.is_active = true
  where p.hp_status = 'skipped'
    and p.o2_status = 'posted'
    and p.esutama_status = 'posted'
    and cardinality(p.image_urls) = 1
), inserted as (
  insert into public.cast_diaries (
    cast_id, title, category, image_url, image_urls, body, posted_at,
    external_url, display_order, source_post_id
  )
  select e.cast_id, e.title, '写メ日記', e.image_urls[1], e.image_urls, e.body,
         e.created_at, null, -extract(epoch from e.created_at)::integer, e.id
  from eligible e
  on conflict (source_post_id) where source_post_id is not null do nothing
  returning source_post_id
)
update public.cast_posts p
set hp_status = 'posted', hp_error = null
from eligible e
where p.id = e.id;

-- 公開日記は在籍中セラピストの読み取りだけに限定する。
revoke all on table public.cast_diaries from anon, authenticated;
drop policy if exists cast_diaries_public_read on public.cast_diaries;
drop policy if exists cast_diaries_read on public.cast_diaries;
drop policy if exists cast_diaries_write on public.cast_diaries;
drop policy if exists cast_diaries_active_cast_read on public.cast_diaries;
create policy cast_diaries_active_cast_read on public.cast_diaries
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.casts c
      where c.id = cast_diaries.cast_id
        and c.is_active = true
    )
  );
grant select on table public.cast_diaries to anon, authenticated;
