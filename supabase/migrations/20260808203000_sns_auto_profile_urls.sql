-- O2・Xの公開URLをログインIDから生成し、認証情報と同時に保存する。
-- パスワードは取得RPCから返さない。

create or replace function public.get_sns_connection_overview_v2(p_store_id uuid)
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

create or replace function public.save_sns_connection_admin_v2(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_x_login_id text,
  p_x_password text,
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
  v_profile_url text;
  v_x_profile_url text;
  v_has_o2_credential boolean;
  v_has_x_credential boolean;
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
  if length(coalesce(v_login_id, '')) > 255 or length(coalesce(v_x_login_id, '')) > 255 then
    raise exception 'IDは255文字以内で入力してください';
  end if;
  if length(coalesce(v_password, '')) > 512 or length(coalesce(v_x_password, '')) > 512 then
    raise exception 'パスワードは512文字以内で入力してください';
  end if;
  if v_login_id is null and v_password is not null then
    raise exception 'O2のIDを入力してください';
  end if;
  if v_x_login_id is null and v_x_password is not null then
    raise exception 'XのIDを入力してください';
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

  if v_login_id is not null and not v_has_o2_credential and v_password is null then
    raise exception 'O2の初回設定ではパスワードも入力してください';
  end if;
  if v_x_login_id is not null and not v_has_x_credential and v_x_password is null then
    raise exception 'Xの初回設定ではパスワードも入力してください';
  end if;

  v_profile_url := case when v_login_id is null then null else 'https://m-sns.net/profile/@' || v_login_id end;
  v_x_profile_url := case when v_x_login_id is null then null else 'https://x.com/' || v_x_login_id end;

  update public.casts
  set o2_created = coalesce(p_o2_created, false),
      o2_linkage_requested = coalesce(p_o2_linkage_requested, false),
      o2_url = v_profile_url,
      x_account = v_x_profile_url
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
end;
$$;

revoke all on function public.get_sns_connection_overview_v2(uuid) from public, anon;
revoke all on function public.save_sns_connection_admin_v2(uuid, uuid, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.get_sns_connection_overview_v2(uuid) to authenticated;
grant execute on function public.save_sns_connection_admin_v2(uuid, uuid, text, text, text, text, boolean, boolean) to authenticated;
