-- 一括投稿の送信先をO2・魂セラピストの2媒体だけにする。
-- 互換性のため hp_status 列は残すが、対象外を示す skipped としてHP写メ日記は作成しない。

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
    'skipped', 'pending', 'pending'
  )
  returning id into v_post_id;

  return v_post_id;
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
    'skipped', 'pending', 'pending'
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

revoke all on function public.create_therapist_post(text, text, text, text[]) from public, anon, authenticated, service_role;
revoke all on function public.create_admin_multi_post(uuid, uuid, text, text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.create_therapist_post(text, text, text, text[]) to anon, authenticated, service_role;
grant execute on function public.create_admin_multi_post(uuid, uuid, text, text, text[]) to authenticated, service_role;
