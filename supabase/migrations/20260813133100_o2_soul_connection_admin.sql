-- O2・魂セラピスト専用の管理保存RPC。
-- 既存のXプロフィールと認証情報は削除せず、そのまま保持する。

create or replace function public.save_o2_soul_connection_admin_v1(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_o2_login_email text,
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
  v_o2_login_email text := nullif(trim(coalesce(p_o2_login_email, '')), '');
  v_estama_profile_url text := nullif(trim(coalesce(p_estama_profile_url, '')), '');
  v_profile_url text;
  v_has_o2_credential boolean;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  if not exists (
    select 1
    from public.casts c
    where c.id = p_cast_id
      and c.store_id = p_store_id
  ) then
    raise exception '対象セラピストが見つかりません';
  end if;

  if v_login_id is not null then
    v_login_id := regexp_replace(v_login_id, '^https?://(www\.)?m-sns\.net/profile/', '', 'i');
    v_login_id := regexp_replace(v_login_id, '^@', '');
  end if;

  if v_o2_login_email is not null
     and v_o2_login_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'O2の登録メールアドレスを確認してください';
  end if;
  if v_login_id is not null and v_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'O2のIDは半角英数字とアンダーバーで入力してください';
  end if;
  if length(coalesce(v_o2_login_email, '')) > 255 then
    raise exception 'メールアドレスは255文字以内で入力してください';
  end if;
  if length(coalesce(v_login_id, '')) > 255 then
    raise exception 'IDは255文字以内で入力してください';
  end if;
  if length(coalesce(v_password, '')) > 512 then
    raise exception 'パスワードは512文字以内で入力してください';
  end if;
  if length(coalesce(v_estama_profile_url, '')) > 2048 then
    raise exception 'プロフィールURLは2048文字以内で入力してください';
  end if;
  if v_estama_profile_url is not null
     and v_estama_profile_url !~* '^https://(www\.)?estama\.jp/' then
    raise exception '魂セラピストのプロフィールURLを入力してください';
  end if;
  if v_login_id is null and v_password is not null then
    raise exception 'O2のIDを入力してください';
  end if;

  select exists (
    select 1
    from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'o2'
  ) into v_has_o2_credential;

  if v_login_id is not null and not v_has_o2_credential and v_password is null then
    raise exception 'O2の初回設定ではパスワードも入力してください';
  end if;

  v_profile_url := case
    when v_login_id is null then null
    else 'https://m-sns.net/profile/@' || v_login_id
  end;

  update public.casts
  set o2_created = coalesce(p_o2_created, false),
      o2_linkage_requested = coalesce(p_o2_linkage_requested, false),
      o2_login_email = v_o2_login_email,
      o2_login_id = v_login_id,
      o2_url = v_profile_url,
      estama_profile_url = v_estama_profile_url
  where id = p_cast_id
    and store_id = p_store_id;

  if v_login_id is null then
    delete from public.cast_site_credentials
    where cast_id = p_cast_id
      and store_id = p_store_id
      and site in ('o2', 'esutama');
  elsif v_has_o2_credential then
    update public.cast_site_credentials
    set login_id = v_login_id,
        password = coalesce(v_password, password),
        updated_at = now()
    where cast_id = p_cast_id
      and store_id = p_store_id
      and site = 'o2';
  else
    insert into public.cast_site_credentials (
      cast_id, store_id, site, login_id, password, updated_at
    ) values (
      p_cast_id, p_store_id, 'o2', v_login_id, v_password, now()
    );
  end if;

  if v_login_id is not null then
    insert into public.cast_site_credentials (
      cast_id, store_id, site, login_id, password, updated_at
    )
    select credentials.cast_id,
           credentials.store_id,
           'esutama',
           credentials.login_id,
           credentials.password,
           now()
    from public.cast_site_credentials credentials
    where credentials.cast_id = p_cast_id
      and credentials.store_id = p_store_id
      and credentials.site = 'o2'
    on conflict (cast_id, site) do update
    set store_id = excluded.store_id,
        login_id = excluded.login_id,
        password = excluded.password,
        updated_at = now();
  end if;
end;
$$;

revoke all on function public.save_o2_soul_connection_admin_v1(
  uuid, uuid, text, text, text, text, boolean, boolean
) from public, anon, authenticated, service_role;

grant execute on function public.save_o2_soul_connection_admin_v1(
  uuid, uuid, text, text, text, text, boolean, boolean
) to authenticated;
