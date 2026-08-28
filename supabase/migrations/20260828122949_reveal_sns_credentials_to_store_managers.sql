-- 保存済みのSNS設定の誤編集を防ぎ、必要な1媒体のPWだけを管理者へ返す。

alter table public.cast_site_credentials enable row level security;

alter table public.casts
  add column if not exists sns_settings_updated_at timestamptz,
  add column if not exists sns_settings_version bigint not null default 0;

comment on column public.casts.sns_settings_updated_at is
  'O2・X・魂セラピスト連携を管理画面から最後に保存した日時。NULLは未保存。';

-- 管理画面以外（セラピスト本人のO2設定など）から認証情報が変わった場合も、
-- 編集中の古い内容で上書きされないように版を進める。
create or replace function public.touch_cast_sns_settings_from_cast_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sns_settings_updated_at := clock_timestamp();
  new.sns_settings_version := old.sns_settings_version + 1;
  return new;
end;
$$;

drop trigger if exists touch_cast_sns_settings_from_cast_v1 on public.casts;
create trigger touch_cast_sns_settings_from_cast_v1
before update of
  o2_created,
  o2_linkage_requested,
  o2_login_email,
  o2_login_id,
  o2_url,
  x_account,
  estama_profile_url
on public.casts
for each row
when (
  old.o2_created is distinct from new.o2_created
  or old.o2_linkage_requested is distinct from new.o2_linkage_requested
  or old.o2_login_email is distinct from new.o2_login_email
  or old.o2_login_id is distinct from new.o2_login_id
  or old.o2_url is distinct from new.o2_url
  or old.x_account is distinct from new.x_account
  or old.estama_profile_url is distinct from new.estama_profile_url
)
execute function public.touch_cast_sns_settings_from_cast_v1();

create or replace function public.touch_cast_sns_settings_from_credential_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.casts
    set sns_settings_updated_at = clock_timestamp(),
        sns_settings_version = sns_settings_version + 1
    where id = old.cast_id
      and store_id = old.store_id;
    return old;
  end if;

  update public.casts
  set sns_settings_updated_at = clock_timestamp(),
      sns_settings_version = sns_settings_version + 1
  where id = new.cast_id
    and store_id = new.store_id;
  return new;
end;
$$;

drop trigger if exists touch_cast_sns_settings_from_credential_v1
  on public.cast_site_credentials;
create trigger touch_cast_sns_settings_from_credential_v1
after insert or update or delete on public.cast_site_credentials
for each row
execute function public.touch_cast_sns_settings_from_credential_v1();

revoke all on function public.touch_cast_sns_settings_from_cast_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.touch_cast_sns_settings_from_credential_v1()
  from public, anon, authenticated, service_role;

-- 既存の設定済みデータは、初回表示から読み取り専用にする。
update public.casts c
set sns_settings_updated_at = c.updated_at,
    sns_settings_version = greatest(c.sns_settings_version, 1)
where c.sns_settings_updated_at is null
  and (
    coalesce(c.o2_created, false)
    or coalesce(c.o2_linkage_requested, false)
    or nullif(trim(c.o2_login_email), '') is not null
    or nullif(trim(c.o2_login_id), '') is not null
    or nullif(trim(c.o2_url), '') is not null
    or nullif(trim(c.x_account), '') is not null
    or nullif(trim(c.estama_profile_url), '') is not null
    or exists (
      select 1
      from public.cast_site_credentials credentials
      where credentials.cast_id = c.id
        and credentials.store_id = c.store_id
        and credentials.site in ('o2', 'x', 'esutama')
    )
  );

-- 現行の管理RPCは、認証情報テーブルの直接権限を外しても動くようにする。
-- どちらも内部で auth.uid() と can_manage_store() を検証している。
alter function public.get_sns_connection_overview_v5(uuid)
  security definer;
alter function public.save_sns_connection_admin_v5(
  uuid, uuid, text, text, text, text, text, text, text, text, boolean, boolean
)
  security definer;

create or replace function public.get_site_connection_status_admin(p_store_id uuid)
returns table(cast_id uuid, site text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception using
      message = 'この店舗を管理する権限がありません',
      errcode = '42501';
  end if;

  return query
  select credentials.cast_id, credentials.site
  from public.cast_site_credentials credentials
  where credentials.store_id = p_store_id
    and nullif(trim(credentials.login_id), '') is not null
    and nullif(trim(credentials.password), '') is not null;
end;
$$;

create or replace function public.get_sns_connection_overview_v6(p_store_id uuid)
returns table(
  cast_id uuid,
  cast_name text,
  photo text,
  o2_created boolean,
  o2_linkage_requested boolean,
  profile_url text,
  credential_configured boolean,
  login_id text,
  o2_login_email text,
  x_profile_url text,
  x_credential_configured boolean,
  x_login_id text,
  estama_profile_url text,
  estama_credential_configured boolean,
  estama_login_id text,
  last_o2_status text,
  last_o2_error text,
  last_posted_at timestamptz,
  settings_updated_at timestamptz,
  settings_version bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception using
      message = 'この店舗を管理する権限がありません',
      errcode = '42501';
  end if;

  return query
  select overview.cast_id,
         overview.cast_name,
         overview.photo,
         overview.o2_created,
         overview.o2_linkage_requested,
         overview.profile_url,
         overview.credential_configured,
         overview.login_id,
         overview.o2_login_email,
         overview.x_profile_url,
         overview.x_credential_configured,
         overview.x_login_id,
         overview.estama_profile_url,
         overview.estama_credential_configured,
         overview.estama_login_id,
         overview.last_o2_status,
         overview.last_o2_error,
         overview.last_posted_at,
         c.sns_settings_updated_at,
         c.sns_settings_version
  from public.get_sns_connection_overview_v5(p_store_id) overview
  join public.casts c
    on c.id = overview.cast_id
   and c.store_id = p_store_id
  order by c.display_order nulls last, overview.cast_name;
end;
$$;

create or replace function public.save_sns_connection_admin_v6(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_o2_login_email text,
  p_x_login_id text,
  p_x_password text,
  p_estama_login_id text,
  p_estama_password text,
  p_estama_profile_url text,
  p_o2_created boolean,
  p_o2_linkage_requested boolean,
  p_expected_settings_version bigint
)
returns table(
  settings_updated_at timestamptz,
  settings_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_settings_version bigint;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception using
      message = 'この店舗を管理する権限がありません',
      errcode = '42501';
  end if;

  select c.sns_settings_version
  into v_current_settings_version
  from public.casts c
  where c.id = p_cast_id
    and c.store_id = p_store_id
  for update;

  if not found then
    raise exception using
      message = '対象セラピストが見つかりません',
      errcode = 'P0002';
  end if;

  if v_current_settings_version is distinct from p_expected_settings_version then
    raise exception using
      message = '他の画面で設定が更新されました。画面を閉じて開き直してください',
      errcode = '40001';
  end if;

  perform public.save_sns_connection_admin_v5(
    p_store_id,
    p_cast_id,
    p_login_id,
    p_password,
    p_o2_login_email,
    p_x_login_id,
    p_x_password,
    p_estama_login_id,
    p_estama_password,
    p_estama_profile_url,
    p_o2_created,
    p_o2_linkage_requested
  );

  update public.casts c
  set sns_settings_updated_at = clock_timestamp(),
      sns_settings_version = c.sns_settings_version + 1
  where c.id = p_cast_id
    and c.store_id = p_store_id
  returning c.sns_settings_updated_at,
            c.sns_settings_version
  into settings_updated_at,
       settings_version;

  return next;
end;
$$;

create or replace function public.get_sns_connection_password_admin_v1(
  p_store_id uuid,
  p_cast_id uuid,
  p_site text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_password text;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception using
      message = 'この店舗を管理する権限がありません',
      errcode = '42501';
  end if;

  if p_site is null or p_site not in ('o2', 'x', 'esutama') then
    raise exception using
      message = '対象媒体が正しくありません',
      errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.casts c
    where c.id = p_cast_id
      and c.store_id = p_store_id
  ) then
    raise exception using
      message = '対象セラピストが見つかりません',
      errcode = 'P0002';
  end if;

  select credentials.password
  into v_password
  from public.cast_site_credentials credentials
  where credentials.store_id = p_store_id
    and credentials.cast_id = p_cast_id
    and credentials.site = p_site;

  return v_password;
end;
$$;

revoke all on function public.get_sns_connection_overview_v6(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.save_sns_connection_admin_v6(
  uuid, uuid, text, text, text, text, text, text, text, text, boolean, boolean, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.get_sns_connection_password_admin_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.get_sns_connection_overview_v6(uuid)
  to authenticated;
grant execute on function public.save_sns_connection_admin_v6(
  uuid, uuid, text, text, text, text, text, text, text, text, boolean, boolean, bigint
) to authenticated;
grant execute on function public.get_sns_connection_password_admin_v1(uuid, uuid, text)
  to authenticated;

revoke all on function public.get_site_connection_status_admin(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_site_connection_status_admin(uuid)
  to authenticated;

-- ブラウザからは接続有無の判定に必要な列だけを読めるようにし、PW列を隠す。
-- 投稿用Edge Functionは service_role のため、この変更の影響を受けない。
revoke all on table public.cast_site_credentials from public, anon, authenticated;
grant select on table public.cast_site_credentials to service_role;

revoke execute on function public.save_sns_connection_admin_v5(
  uuid, uuid, text, text, text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated, service_role;
