-- 管理者がセラピスト本人に代わってO2認証情報と公開プロフィールURLを
-- 一括管理するためのRPC。パスワードは取得系RPCから返さない。

create or replace function public.get_sns_connection_overview(p_store_id uuid)
returns table(
  cast_id uuid,
  cast_name text,
  photo text,
  o2_created boolean,
  o2_linkage_requested boolean,
  profile_url text,
  credential_configured boolean,
  login_id text,
  last_o2_status text,
  last_o2_error text,
  last_posted_at timestamptz
)
language plpgsql
security definer
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
         credentials.login_id is not null and credentials.password is not null,
         credentials.login_id,
         latest.o2_status,
         latest.o2_error,
         latest.created_at
  from public.casts c
  left join public.cast_site_credentials credentials
    on credentials.cast_id = c.id
   and credentials.store_id = p_store_id
   and credentials.site = 'o2'
   and nullif(trim(credentials.login_id), '') is not null
   and nullif(credentials.password, '') is not null
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

create or replace function public.save_sns_connection_admin(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_profile_url text,
  p_o2_created boolean,
  p_o2_linkage_requested boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_login_id text := nullif(trim(coalesce(p_login_id, '')), '');
  v_password text := nullif(coalesce(p_password, ''), '');
  v_profile_url text := nullif(trim(coalesce(p_profile_url, '')), '');
  v_has_credential boolean;
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

  if v_profile_url is not null and v_profile_url !~* '^https://' then
    raise exception 'プロフィールURLはhttps://から入力してください';
  end if;
  if length(coalesce(v_login_id, '')) > 255 then
    raise exception 'IDは255文字以内で入力してください';
  end if;
  if length(coalesce(v_password, '')) > 512 then
    raise exception 'パスワードは512文字以内で入力してください';
  end if;
  if length(coalesce(v_profile_url, '')) > 2048 then
    raise exception 'プロフィールURLが長すぎます';
  end if;

  update public.casts
  set o2_created = coalesce(p_o2_created, false),
      o2_linkage_requested = coalesce(p_o2_linkage_requested, false),
      o2_url = v_profile_url
  where id = p_cast_id and store_id = p_store_id;

  select exists (
    select 1
    from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'o2'
  ) into v_has_credential;

  if v_login_id is null and v_password is not null then
    raise exception 'IDを入力してください';
  elsif v_login_id is not null and not v_has_credential and v_password is null then
    raise exception '初回設定ではパスワードも入力してください';
  elsif v_login_id is not null and v_has_credential then
    update public.cast_site_credentials
    set login_id = v_login_id,
        password = coalesce(v_password, password),
        store_id = p_store_id,
        updated_at = now()
    where cast_id = p_cast_id and site = 'o2';
  elsif v_login_id is not null then
    insert into public.cast_site_credentials (cast_id, store_id, site, login_id, password, updated_at)
    values (p_cast_id, p_store_id, 'o2', v_login_id, v_password, now());
  end if;
end;
$$;

-- 旧casts列に残る登録用ID等は公開プロフィールに不要なため匿名取得を止める。
revoke select (o2_login_id, o2_login_email, o2_login_url)
  on table public.casts from anon;

revoke all on function public.get_sns_connection_overview(uuid) from public, anon;
revoke all on function public.save_sns_connection_admin(uuid, uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.get_sns_connection_overview(uuid) to authenticated;
grant execute on function public.save_sns_connection_admin(uuid, uuid, text, text, text, boolean, boolean) to authenticated;
