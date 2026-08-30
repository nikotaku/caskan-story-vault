-- O2の送信結果を投稿ID単位で監査し、XはIDだけでも保管できるようにする。

alter table public.cast_posts
  add column if not exists o2_post_id text,
  add column if not exists o2_post_url text;

alter table public.cast_site_credentials
  alter column password drop not null;

comment on column public.cast_posts.o2_post_id is
  'O2への公開後に投稿一覧の差分から取得し、詳細ページで検証した投稿ID。';
comment on column public.cast_posts.o2_post_url is
  'O2投稿の公開詳細URL。結果要確認の場合も候補を特定できたときは保存する。';

-- 旧方式は一覧に省略表示された長文を全文一致で探していたため、
-- 実際には公開済みでも失敗扱いになることがあった。重複再送を止める。
update public.cast_posts
set o2_error = '【要確認・再送停止】旧方式ではO2への掲載結果を確定できません。O2側を確認するまで再送できません'
where o2_status = 'failed'
  and o2_error = 'O2の投稿一覧で公開完了を確認できませんでした。投稿状態を確認してください';

create or replace function public.get_sns_connection_overview_v7(p_store_id uuid)
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
  x_password_configured boolean,
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
         nullif(trim(overview.x_login_id), '') is not null,
         exists (
           select 1
           from public.cast_site_credentials credentials
           where credentials.store_id = p_store_id
             and credentials.cast_id = overview.cast_id
             and credentials.site = 'x'
             and nullif(credentials.password, '') is not null
         ),
         overview.x_login_id,
         overview.estama_profile_url,
         overview.estama_credential_configured,
         overview.estama_login_id,
         overview.last_o2_status,
         overview.last_o2_error,
         overview.last_posted_at,
         overview.settings_updated_at,
         overview.settings_version
  from public.get_sns_connection_overview_v6(p_store_id) overview
  join public.casts c
    on c.id = overview.cast_id
   and c.store_id = p_store_id
  order by c.display_order nulls last, overview.cast_name;
end;
$$;

create or replace function public.save_sns_connection_admin_v7(
  p_store_id uuid,
  p_cast_id uuid,
  p_login_id text,
  p_password text,
  p_o2_login_email text,
  p_x_login_id text,
  p_x_password text,
  p_delete_x_password boolean,
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
  v_x_login_id text := nullif(trim(coalesce(p_x_login_id, '')), '');
  v_x_password text := nullif(coalesce(p_x_password, ''), '');
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

  if coalesce(p_delete_x_password, false) and v_x_password is not null then
    raise exception using
      message = 'Xのパスワードは変更か削除のどちらか一方を選んでください',
      errcode = '22023';
  end if;

  -- XのIDだけを初回保存する場合は、同一トランザクション内でPWなしの行を先に作り、
  -- v5のO2・魂向け必須検査はそのまま保持する。
  if v_x_login_id is not null
     and not exists (
       select 1
       from public.cast_site_credentials credentials
       where credentials.store_id = p_store_id
         and credentials.cast_id = p_cast_id
         and credentials.site = 'x'
     ) then
    insert into public.cast_site_credentials (
      cast_id, store_id, site, login_id, password, updated_at
    ) values (
      p_cast_id, p_store_id, 'x', v_x_login_id, null, now()
    );
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

  if coalesce(p_delete_x_password, false) and v_x_login_id is not null then
    update public.cast_site_credentials
    set password = null,
        updated_at = now()
    where store_id = p_store_id
      and cast_id = p_cast_id
      and site = 'x';
  end if;

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

revoke all on function public.get_sns_connection_overview_v7(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.save_sns_connection_admin_v7(
  uuid, uuid, text, text, text, text, text, boolean, text, text, text, boolean, boolean, bigint
) from public, anon, authenticated, service_role;

grant execute on function public.get_sns_connection_overview_v7(uuid)
  to authenticated;
grant execute on function public.save_sns_connection_admin_v7(
  uuid, uuid, text, text, text, text, text, boolean, text, text, text, boolean, boolean, bigint
) to authenticated;
