-- メールアドレスの厳密な形式チェックをDB側にも適用する。
-- これまでの緩い正規表現（^[^@]+@[^@]+\.[^@]+$）では
-- 「example,jp」（カンマ）や「a@b..jp」（連続ドット）、全角混入などを弾けなかった。
-- フロントエンド（src/lib/email.ts）と同じルールをDBの最終防衛線として実装する。

-- 共通のメール形式チェック関数。
-- ローカル部: 半角英数字と一般的記号のみ、先頭/末尾/連続ドット不可、64文字まで。
-- ドメイン: ドット区切りのラベル（英数字とハイフン、先頭/末尾ハイフン不可）、
--           最終ラベル（TLD）は2文字以上の英字、全体253文字まで。
create or replace function public.is_valid_email(p_email text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_email text := trim(coalesce(p_email, ''));
  v_local text;
  v_domain text;
  v_tld text;
begin
  if v_email = '' or length(v_email) > 255 then
    return false;
  end if;
  -- 半角ASCII（空白・全角・制御文字を含まない）のみ許可。カンマはドメイン区切りに使えない。
  if v_email ~ '[^!-~]' then
    return false;
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$' then
    return false;
  end if;
  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);
  if length(v_local) > 64 or length(v_domain) > 253 then
    return false;
  end if;
  -- ローカル部: 先頭・末尾は英数字、連続ドット不可
  if v_local ~ '\.\.'
     or v_local !~ '^[A-Za-z0-9]([A-Za-z0-9!#$%&''*+/=?^_`{|}~.-]*[A-Za-z0-9])?$' then
    return false;
  end if;
  -- ドメイン: ドットを含み、各ラベルは英数字とハイフンのみ（先頭・末尾ハイフン不可）
  if position('.' in v_domain) = 0 then
    return false;
  end if;
  if exists (
    select 1
    from unnest(string_to_array(v_domain, '.')) as label(part)
    where part = ''
       or length(part) > 63
       or part !~ '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$'
  ) then
    return false;
  end if;
  -- TLDは2文字以上の英字
  v_tld := (string_to_array(v_domain, '.'))[array_length(string_to_array(v_domain, '.'), 1)];
  if v_tld !~ '^[A-Za-z]{2,}$' then
    return false;
  end if;
  return true;
end;
$$;

-- 管理画面（O2・X・魂セラピスト連携）の保存RPC。
-- 20260822171000_separate_sns_credentials.sql の定義を維持しつつ、
-- メールチェックだけ共通関数 public.is_valid_email へ置き換える。
create or replace function public.save_sns_connection_admin_v5(
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
  v_o2_login_email text := nullif(trim(coalesce(p_o2_login_email, '')), '');
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
  if v_x_login_id is not null then
    v_x_login_id := regexp_replace(v_x_login_id, '^https?://(www\.)?(x|twitter)\.com/', '', 'i');
    v_x_login_id := regexp_replace(v_x_login_id, '^@', '');
  end if;
  if v_o2_login_email is not null
     and not public.is_valid_email(v_o2_login_email) then
    raise exception 'O2の登録メールアドレスの形式が正しくありません（例: therapist@example.jp）';
  end if;
  if v_login_id is not null and v_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'O2のIDは半角英数字とアンダーバーで入力してください';
  end if;
  if v_x_login_id is not null and v_x_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'XのIDは半角英数字とアンダーバーで入力してください';
  end if;
  if length(coalesce(v_o2_login_email, '')) > 255 then
    raise exception 'メールアドレスは255文字以内で入力してください';
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
  if v_estama_profile_url is not null
     and v_estama_profile_url !~* '^https://(www\.)?estama\.jp/' then
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
      o2_login_email = v_o2_login_email,
      o2_login_id = v_login_id,
      o2_url = v_profile_url,
      x_account = v_x_profile_url,
      estama_profile_url = v_estama_profile_url
  where id = p_cast_id
    and store_id = p_store_id;
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

-- セラピストポータルからの保存RPCにも厳密チェックを適用する。
-- 20260822171000_separate_sns_credentials.sql の定義を維持しつつ、
-- メールチェックだけ共通関数 public.is_valid_email へ置き換える。
create or replace function public.save_therapist_o2_credentials(
  p_token text,
  p_login_email text,
  p_login_id text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_login_email text := nullif(trim(coalesce(p_login_email, '')), '');
  v_login_id text := nullif(trim(coalesce(p_login_id, '')), '');
  v_password text := nullif(coalesce(p_password, ''), '');
begin
  if v_login_id is not null then
    v_login_id := regexp_replace(v_login_id, '^https?://(www\.)?m-sns\.net/profile/', '', 'i');
    v_login_id := regexp_replace(v_login_id, '^@', '');
  end if;
  if v_login_id is null or v_password is null then
    raise exception 'O2のIDとパスワードを入力してください';
  end if;
  if v_login_email is not null
     and not public.is_valid_email(v_login_email) then
    raise exception 'O2の登録メールアドレスの形式が正しくありません（例: therapist@example.jp）';
  end if;
  if v_login_id !~ '^[A-Za-z0-9_]+$' then
    raise exception 'O2のIDは半角英数字とアンダーバーで入力してください';
  end if;
  if length(coalesce(v_login_email, '')) > 255 then
    raise exception 'メールアドレスは255文字以内で入力してください';
  end if;
  if length(v_login_id) > 255 then
    raise exception 'IDは255文字以内で入力してください';
  end if;
  if length(v_password) > 512 then
    raise exception 'パスワードは512文字以内で入力してください';
  end if;
  select c.id, c.store_id
  into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token;
  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;
  update public.casts
  set o2_login_email = v_login_email,
      o2_login_id = v_login_id,
      o2_url = 'https://m-sns.net/profile/@' || v_login_id
  where id = v_cast_id
    and store_id = v_store_id;
  insert into public.cast_site_credentials (
    cast_id, store_id, site, login_id, password, updated_at
  ) values (
    v_cast_id, v_store_id, 'o2', v_login_id, v_password, now()
  )
  on conflict (cast_id, site) do update
  set store_id = excluded.store_id,
      login_id = excluded.login_id,
      password = excluded.password,
      updated_at = now();
end;
$$;

revoke all on function public.is_valid_email(text) from public, anon, authenticated, service_role;
grant execute on function public.is_valid_email(text) to authenticated, service_role;
