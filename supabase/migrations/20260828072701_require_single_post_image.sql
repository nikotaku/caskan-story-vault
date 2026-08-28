-- O2・魂セラピストへの同時投稿は、600x600 に整形済みの画像1枚を共通で使用する。
-- 既存投稿には画像0枚・複数枚の履歴があるため一括更新は行わず、
-- 新規投稿と image_urls を変更する更新だけを厳密に検証する。

create or replace function public.require_single_image_for_cast_post()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_image_url text;
begin
  if coalesce(cardinality(new.image_urls), 0) <> 1 then
    raise exception '画像は1枚必須です';
  end if;

  select trim(images.image_url)
    into v_image_url
  from unnest(new.image_urls) as images(image_url);

  if v_image_url is null
     or v_image_url = ''
     or v_image_url !~ '^https://[^[:space:]]+$' then
    raise exception '画像URLが不正です';
  end if;

  new.image_urls := array[v_image_url];
  return new;
end;
$$;

drop trigger if exists require_single_image_for_cast_post on public.cast_posts;
create trigger require_single_image_for_cast_post
before insert or update of image_urls on public.cast_posts
for each row
execute function public.require_single_image_for_cast_post();

revoke all on function public.require_single_image_for_cast_post()
  from public, anon, authenticated, service_role;

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
  v_image_url text;
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
    'skipped', 'pending', 'pending'
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

revoke all on function public.create_therapist_post(text, text, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.create_admin_multi_post(uuid, uuid, text, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_therapist_post(text, text, text, text[])
  to anon, authenticated, service_role;
grant execute on function public.create_admin_multi_post(uuid, uuid, text, text, text[])
  to authenticated, service_role;
