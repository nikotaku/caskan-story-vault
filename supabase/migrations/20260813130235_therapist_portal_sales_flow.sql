-- セラピストマイページの予約編集・売上確定と、受付終了連絡を安全に行う。

-- 過去の重複レコードは維持しつつ、今後のポータル送信だけは
-- セラピスト×営業日で1件にまとめる。
alter table public.daily_sales_records
  add column if not exists submission_key text,
  add column if not exists manual_adjustment integer not null default 0;

create unique index if not exists daily_sales_records_submission_key_key
  on public.daily_sales_records (submission_key)
  where submission_key is not null;

-- ポータルは casts.access_token を正として運用中。旧分離テーブルしかない
-- 環境でもマイグレーションを再生できるよう、列を明示して同期する。
alter table public.casts
  add column if not exists access_token text;
do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.casts'::regclass
      and i.indisunique
      and (
        select array_agg(a.attname order by key_column.ordinality)
        from unnest(i.indkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = i.indrelid
         and a.attnum = key_column.attnum
      ) = array['access_token']::name[]
  ) then
    create unique index idx_casts_access_token on public.casts (access_token);
  end if;
end;
$$;
update public.casts c
set access_token = t.access_token
from public.cast_access_tokens t
where t.cast_id = c.id
  and c.access_token is null;

insert into public.cast_access_tokens (cast_id, access_token)
select c.id, c.access_token
from public.casts c
where c.access_token is not null
on conflict (cast_id) do nothing;

update public.cast_access_tokens t
set store_id = c.store_id
from public.casts c
where c.id = t.cast_id
  and t.store_id is distinct from c.store_id;

-- 分離テーブルを管理画面用の正とし、互換列はポータルRPCのためだけに同期する。
update public.casts c
set access_token = t.access_token
from public.cast_access_tokens t
where t.cast_id = c.id
  and c.access_token is distinct from t.access_token;

-- 本番先行で存在していた、今回のフローが使う列を履歴にも収束させる。
alter table public.reservations
  add column if not exists payment_details jsonb,
  add column if not exists discount_ids text[] not null default array[]::text[];
alter table public.casts
  add column if not exists line_group_id text;
alter table public.shop_settings
  add column if not exists business_day_start text not null default '10:00';

-- 長寿命のポータルトークンを通常のcasts SELECT/UPDATEから分離する。
-- 管理画面は安全なviewと下記の管理RPCだけを利用する。
revoke select, update on table public.casts from authenticated;
do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'casts'
    and column_name not in ('access_token', 'o2_login_password');

  execute 'grant select (' || v_columns || '), update (' || v_columns
    || ') on public.casts to authenticated';

  execute 'drop view if exists public.casts_admin_safe';
  execute 'create view public.casts_admin_safe with (security_invoker = true) as select '
    || v_columns || ' from public.casts';
end;
$$;
revoke all on public.casts_admin_safe from public, anon;
grant select on public.casts_admin_safe to authenticated;

create or replace function public.get_cast_access_tokens()
returns table (cast_id uuid, access_token text)
language sql
stable
security definer
set search_path = public
as $$
  select t.cast_id, t.access_token
  from public.cast_access_tokens t
  join public.casts c on c.id = t.cast_id
  where public.can_manage_store(c.store_id)
$$;

create or replace function public.set_cast_access_token(p_cast_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
begin
  select c.store_id into v_store_id
  from public.casts c
  where c.id = p_cast_id;

  if v_store_id is null
     or auth.uid() is null
     or not public.can_manage_store(v_store_id)
     or nullif(trim(p_token), '') is null then
    raise exception 'unauthorized';
  end if;

  insert into public.cast_access_tokens (cast_id, access_token, store_id)
  values (p_cast_id, p_token, v_store_id)
  on conflict (cast_id) do update
  set access_token = excluded.access_token,
      store_id = excluded.store_id,
      updated_at = now();

  update public.casts
  set access_token = p_token
  where id = p_cast_id;
end;
$$;

revoke execute on function public.get_cast_access_tokens() from public, anon;
revoke execute on function public.set_cast_access_token(uuid, text) from public, anon;
grant execute on function public.get_cast_access_tokens() to authenticated;
grant execute on function public.set_cast_access_token(uuid, text) to authenticated;

-- 旧anon送信で既定店舗に入った売上報告を、担当セラピストの店舗へ戻す。
update public.daily_sales_records d
set store_id = c.store_id
from public.casts c
where c.id = d.cast_id
  and d.store_id is distinct from c.store_id;

-- 旧ポリシーは anon を含む全ロールに売上台帳の全操作を許していた。
-- セラピストは下記の token 検証付きRPCだけを使い、管理画面は既存の
-- authenticated / store_isolation ポリシーを使う。
drop policy if exists allow_all_daily_sales_records
  on public.daily_sales_records;
revoke all on table public.daily_sales_records from anon;

-- store_isolation は RESTRICTIVE のため、所属店舗を許可する PERMISSIVE policy も必要。
drop policy if exists daily_sales_records_store_access
  on public.daily_sales_records;
drop policy if exists daily_sales_records_managers_select
  on public.daily_sales_records;
drop policy if exists daily_sales_records_managers_update
  on public.daily_sales_records;
create policy daily_sales_records_managers_select
  on public.daily_sales_records
  as permissive
  for select
  to authenticated
  using (public.can_manage_store(store_id));
create policy daily_sales_records_managers_update
  on public.daily_sales_records
  as permissive
  for update
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- 本番に先行して存在していたRPCを、リポジトリの移行履歴にも収録する。
-- discount_ids は実テーブルに合わせて text[] に統一する。
drop function if exists public.therapist_update_reservation(
  text, uuid, text, integer, text, text[], integer, uuid[], integer, integer, text, text
);

create or replace function public.therapist_update_reservation(
  p_token text,
  p_reservation_id uuid,
  p_course_type text,
  p_duration integer,
  p_course_name text,
  p_options text[],
  p_discount integer,
  p_discount_ids text[],
  p_price integer,
  p_payment_fee integer,
  p_payment_method text,
  p_nomination_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_reservation public.reservations%rowtype;
  v_base_price integer;
  v_option_price integer := 0;
  v_nomination_price integer := 0;
  v_expected_price integer;
  v_fee_percentage numeric := 0;
  v_expected_fee integer := 0;
  v_has_split_payment boolean := false;
  v_is_pair_cast boolean := false;
  v_day_start time := '10:00:00';
  v_current_business_date date;
begin
  select c.id, c.store_id
    into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;
  select c.name ~ '[&＆]'
    into v_is_pair_cast
  from public.casts c
  where c.id = v_cast_id;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(v_cast_id::text || ':' || v_current_business_date::text, 0)
  );

  if exists (
    select 1
    from public.daily_sales_records d
    where d.cast_id = v_cast_id
      and d.date = v_current_business_date
      and d.status = 'confirmed'
  ) then
    raise exception 'confirmed sales cannot be edited; contact store staff';
  end if;

  select r.*
    into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.cast_id = v_cast_id
    and r.store_id = v_store_id
    and r.status in ('confirmed', 'completed')
    and (
      (r.reservation_date = v_current_business_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = v_current_business_date + 1 and r.start_time < v_day_start)
    );

  if not found then
    raise exception 'reservation not found or not owned by cast';
  end if;

  v_has_split_payment := case
    when jsonb_typeof(v_reservation.payment_details) = 'array'
      then jsonb_array_length(v_reservation.payment_details) > 0
    else false
  end;

  if not v_has_split_payment
     and (p_payment_method is null or p_payment_method not in ('cash', 'card', 'paypay')) then
    raise exception 'invalid payment method';
  end if;

  if p_duration is null
     or p_discount is null
     or p_price is null
     or p_payment_fee is null
     or p_duration <= 0
     or p_discount < 0
     or p_price < 0
     or p_payment_fee < 0 then
    raise exception 'invalid amount';
  end if;

  -- 別店舗の料金名を混ぜられないよう、所属店舗のマスターだけを許可する。
  select b.customer_price
    into v_base_price
  from public.back_rates b
  where b.store_id = v_store_id
    and b.course_type = p_course_type
    and b.duration = p_duration
    and (b.is_visible or v_is_pair_cast or b.course_type = v_reservation.course_type)
  limit 1;

  if v_base_price is null then
    raise exception 'invalid course';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_options, array[]::text[])) as requested(option_name)
    where not exists (
      select 1
      from public.option_rates o
      where o.store_id = v_store_id
        and o.option_name = requested.option_name
        and (o.is_visible or v_is_pair_cast or o.option_name = any(coalesce(v_reservation.options, array[]::text[])))
    )
  ) then
    raise exception 'invalid option';
  end if;

  select coalesce(sum(o.customer_price), 0)::integer
    into v_option_price
  from unnest(coalesce(p_options, array[]::text[])) as requested(option_name)
  join public.option_rates o
    on o.store_id = v_store_id
   and o.option_name = requested.option_name;
  if exists (
    select 1
    from unnest(coalesce(p_options, array[]::text[])) as requested(option_name)
    join public.option_rates o
      on o.store_id = v_store_id
     and o.option_name = requested.option_name
    where not o.is_visible
      and not v_is_pair_cast
      and not (o.option_name = any(coalesce(v_reservation.options, array[]::text[])))
  ) then
    raise exception 'option is not available for this cast';
  end if;

  if p_nomination_type is not null and p_nomination_type <> 'none' then
    select n.customer_price
      into v_nomination_price
    from public.nomination_rates n
    where n.store_id = v_store_id
      and n.nomination_type = p_nomination_type
    limit 1;

    if v_nomination_price is null then
      raise exception 'invalid nomination';
    end if;
  end if;

  v_expected_price := v_base_price + v_option_price + coalesce(v_nomination_price, 0);
  if p_discount > v_expected_price then
    raise exception 'invalid discount';
  end if;
  v_expected_price := v_expected_price - p_discount;
  if p_price <> v_expected_price then
    raise exception 'price does not match store rates';
  end if;

  if v_has_split_payment and p_price <> v_reservation.price then
    raise exception 'split payment amount must be changed by store staff';
  end if;

  if p_payment_method = 'card' then
    select coalesce(p.fee_percentage, 0)
      into v_fee_percentage
    from public.payment_settings p
    where p.store_id = v_store_id
      and p.payment_method ~* '(card|クレジット|カード)'
    limit 1;
  elsif p_payment_method = 'paypay' then
    select coalesce(p.fee_percentage, 0)
      into v_fee_percentage
    from public.payment_settings p
    where p.store_id = v_store_id
      and p.payment_method ~* 'paypay'
    limit 1;
  end if;
  v_expected_fee := round(p_price * coalesce(v_fee_percentage, 0) / 100.0)::integer;
  if p_payment_fee <> v_expected_fee then
    raise exception 'payment fee does not match store settings';
  end if;

  update public.reservations
  set course_type = p_course_type,
      duration = p_duration,
      course_name = p_course_type || ' ' || p_duration::text || '分',
      options = coalesce(p_options, array[]::text[]),
      discount = p_discount,
      -- セラピスト画面の割引は自由金額入力。割引マスターIDとは混在させない。
      discount_ids = array[]::text[],
      price = p_price,
      payment_fee = case when v_has_split_payment then v_reservation.payment_fee else p_payment_fee end,
      payment_method = case when v_has_split_payment then v_reservation.payment_method else p_payment_method end,
      nomination_type = nullif(p_nomination_type, 'none'),
      updated_at = now()
  where id = p_reservation_id;

  -- 送信済みの未承認報告は編集前の内訳なので無効化する。
  delete from public.daily_sales_records d
  where d.cast_id = v_cast_id
    and d.date = v_current_business_date
    and d.status = 'pending';
end;
$$;

-- 予約テーブルを anon で直接読む代わりに、token 所有者の営業日分だけを返す。
create or replace function public.get_therapist_daily_reservations(
  p_token text,
  p_date date
)
returns table (
  id uuid,
  reservation_date date,
  customer_name text,
  start_time time,
  course_name text,
  course_type text,
  duration integer,
  options text[],
  discount integer,
  discount_ids text[],
  price integer,
  payment_method text,
  payment_details jsonb,
  payment_fee integer,
  status text,
  nomination_type text,
  room text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_day_start time := '10:00:00';
  v_current_business_date date;
begin
  select c.id, c.store_id
    into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;
  if p_date <> v_current_business_date then
    raise exception 'reservations are available only for the current business day';
  end if;

  return query
  select
    r.id,
    r.reservation_date,
    r.customer_name,
    r.start_time,
    r.course_name,
    r.course_type,
    r.duration,
    r.options,
    r.discount,
    r.discount_ids,
    r.price,
    r.payment_method,
    r.payment_details,
    r.payment_fee,
    r.status,
    r.nomination_type,
    r.room
  from public.reservations r
  where r.cast_id = v_cast_id
    and r.store_id = v_store_id
    and r.status in ('confirmed', 'completed')
    and (
      (r.reservation_date = p_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = p_date + 1 and r.start_time < v_day_start)
    )
  order by r.reservation_date, r.start_time;
end;
$$;

-- 編集に必要な料金マスターをtokenの所属店舗だけ返す。
-- Wコース等、現在の予約で使われる非表示マスターも編集互換のため含める。
create or replace function public.get_therapist_sales_masters(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_cast_id uuid;
  v_is_pair_cast boolean := false;
  v_day_start time := '10:00:00';
  v_current_business_date date;
  v_result jsonb;
begin
  select c.id, c.store_id, c.name ~ '[&＆]'
    into v_cast_id, v_store_id, v_is_pair_cast
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_store_id is null then
    raise exception 'invalid token';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;

  select jsonb_build_object(
    'store_id', v_store_id,
    'back_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'course_type', b.course_type,
        'duration', b.duration,
        'customer_price', b.customer_price
      ) order by b.display_order, b.duration)
      from public.back_rates b
      where b.store_id = v_store_id
        and (
          b.is_visible
          or v_is_pair_cast
          or exists (
            select 1 from public.reservations r
            where r.cast_id = v_cast_id
              and r.store_id = v_store_id
              and r.status in ('confirmed', 'completed')
              and r.course_type = b.course_type
              and (
                (r.reservation_date = v_current_business_date and r.start_time >= v_day_start)
                or
                (r.reservation_date = v_current_business_date + 1 and r.start_time < v_day_start)
              )
          )
        )
    ), '[]'::jsonb),
    'option_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'option_name', o.option_name,
        'customer_price', o.customer_price
      ) order by o.display_order, o.option_name)
      from public.option_rates o
      where o.store_id = v_store_id
        and (
          o.is_visible
          or v_is_pair_cast
          or exists (
            select 1 from public.reservations r
            where r.cast_id = v_cast_id
              and r.store_id = v_store_id
              and r.status in ('confirmed', 'completed')
              and o.option_name = any(coalesce(r.options, array[]::text[]))
              and (
                (r.reservation_date = v_current_business_date and r.start_time >= v_day_start)
                or
                (r.reservation_date = v_current_business_date + 1 and r.start_time < v_day_start)
              )
          )
        )
    ), '[]'::jsonb),
    'nomination_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'nomination_type', n.nomination_type,
        'customer_price', n.customer_price
      ) order by n.customer_price, n.nomination_type)
      from public.nomination_rates n
      where n.store_id = v_store_id
    ), '[]'::jsonb),
    'payment_settings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'payment_method', p.payment_method,
        'payment_link', p.payment_link,
        'fee_percentage', p.fee_percentage
      ) order by p.payment_method)
      from public.payment_settings p
      where p.store_id = v_store_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.therapist_update_payment_method(
  p_token text,
  p_reservation_id uuid,
  p_payment_method text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_day_start time := '10:00:00';
  v_current_business_date date;
  v_price integer;
  v_fee_percentage numeric := 0;
begin
  select c.id, c.store_id into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;

  if p_payment_method not in ('cash', 'card', 'paypay') then
    raise exception 'invalid payment method';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(v_cast_id::text || ':' || v_current_business_date::text, 0)
  );

  if exists (
    select 1
    from public.daily_sales_records d
    where d.cast_id = v_cast_id
      and d.date = v_current_business_date
      and d.status = 'confirmed'
  ) then
    raise exception 'confirmed sales cannot be edited; contact store staff';
  end if;

  select r.price
    into v_price
  from public.reservations r
  where r.id = p_reservation_id
    and r.cast_id = v_cast_id
    and r.store_id = v_store_id
    and r.status in ('confirmed', 'completed')
    and (
      (r.reservation_date = v_current_business_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = v_current_business_date + 1 and r.start_time < v_day_start)
    )
    and not (case
      when jsonb_typeof(r.payment_details) = 'array'
        then jsonb_array_length(r.payment_details) > 0
      else false
    end);

  if v_price is null then
    raise exception 'reservation not found, out of date, or uses split payment';
  end if;

  if p_payment_method = 'card' then
    select coalesce(p.fee_percentage, 0)
      into v_fee_percentage
    from public.payment_settings p
    where p.store_id = v_store_id
      and p.payment_method ~* '(card|クレジット|カード)'
    limit 1;
  elsif p_payment_method = 'paypay' then
    select coalesce(p.fee_percentage, 0)
      into v_fee_percentage
    from public.payment_settings p
    where p.store_id = v_store_id
      and p.payment_method ~* 'paypay'
    limit 1;
  end if;

  update public.reservations
  set payment_method = p_payment_method,
      payment_fee = round(v_price * coalesce(v_fee_percentage, 0) / 100.0)::integer,
      updated_at = now()
  where id = p_reservation_id
    and cast_id = v_cast_id
    and store_id = v_store_id
    and status in ('confirmed', 'completed')
    and (
      (reservation_date = v_current_business_date and start_time >= v_day_start)
      or
      (reservation_date = v_current_business_date + 1 and start_time < v_day_start)
    );

  if not found then
    raise exception 'reservation not found or not owned by cast';
  end if;

  -- 送信済みの未承認報告は決済変更前の内訳なので無効化する。
  delete from public.daily_sales_records d
  where d.cast_id = v_cast_id
    and d.date = v_current_business_date
    and d.status = 'pending';
end;
$$;

-- 売上送信はトークンから cast_id / store_id を確定し、同じ営業日は更新する。
create or replace function public.therapist_submit_daily_sales(
  p_token text,
  p_date date,
  p_cash_amount integer,
  p_card_amount integer,
  p_paypay_amount integer,
  p_total_amount integer,
  p_customer_count integer,
  p_manual_adjustment integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_key text;
  v_id uuid;
  v_day_start time := '10:00:00';
  v_cash_amount integer := 0;
  v_card_amount integer := 0;
  v_paypay_amount integer := 0;
  v_customer_count integer := 0;
  v_current_business_date date;
begin
  select c.id, c.store_id
    into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;

  if p_cash_amount is null
     or p_card_amount is null
     or p_paypay_amount is null
     or p_total_amount is null
     or p_customer_count is null
     or p_manual_adjustment is null
     or p_cash_amount < 0
     or p_card_amount < 0
     or p_paypay_amount < 0
     or p_total_amount < 0
     or p_customer_count < 0 then
    raise exception 'invalid sales amount';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;
  if p_date <> v_current_business_date then
    raise exception 'sales can only be submitted for the current business day';
  end if;

  v_key := v_cast_id::text || ':' || p_date::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  with day_reservations as (
    select r.*
    from public.reservations r
    where r.cast_id = v_cast_id
      and r.store_id = v_store_id
      and r.status in ('confirmed', 'completed')
      and (
        (r.reservation_date = p_date and r.start_time >= v_day_start)
        or
        (r.reservation_date = p_date + 1 and r.start_time < v_day_start)
      )
  ), split_rows as (
    select
      case
        when lower(coalesce(detail.value->>'method', '')) ~ '(card|カード|クレジット)' then 'card'
        when lower(coalesce(detail.value->>'method', '')) ~ '(paypay|ペイペイ)' then 'paypay'
        else 'cash'
      end as method,
      coalesce((detail.value->>'amount')::numeric, 0) as base_amount
    from day_reservations r
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(r.payment_details) = 'array' then r.payment_details
        else '[]'::jsonb
      end
    ) detail(value)
  ), payment_rows as (
    select
      s.method,
      (
        s.base_amount + case
          when s.method = 'card' then round(s.base_amount * coalesce((
            select max(p.fee_percentage)
            from public.payment_settings p
            where p.store_id = v_store_id
              and p.payment_method ~* '(card|クレジット|カード)'
          ), 0) / 100.0)
          when s.method = 'paypay' then round(s.base_amount * coalesce((
            select max(p.fee_percentage)
            from public.payment_settings p
            where p.store_id = v_store_id
              and p.payment_method ~* 'paypay'
          ), 0) / 100.0)
          else 0
        end
      )::integer as amount
    from split_rows s

    union all

    select
      case
        when lower(coalesce(r.payment_method, '')) ~ '(card|カード|クレジット)' then 'card'
        when lower(coalesce(r.payment_method, '')) ~ '(paypay|ペイペイ)' then 'paypay'
        else 'cash'
      end as method,
      coalesce(r.price, 0) + coalesce(r.payment_fee, 0) as amount
    from day_reservations r
    where case
      when jsonb_typeof(r.payment_details) = 'array'
        then jsonb_array_length(r.payment_details) = 0
      else true
    end
  )
  select
    coalesce(sum(amount) filter (where method = 'cash'), 0)::integer,
    coalesce(sum(amount) filter (where method = 'card'), 0)::integer,
    coalesce(sum(amount) filter (where method = 'paypay'), 0)::integer
  into v_cash_amount, v_card_amount, v_paypay_amount
  from payment_rows;

  select count(*)::integer
    into v_customer_count
  from public.reservations r
  where r.cast_id = v_cast_id
    and r.store_id = v_store_id
    and r.status in ('confirmed', 'completed')
    and (
      (r.reservation_date = p_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = p_date + 1 and r.start_time < v_day_start)
    );

  if p_cash_amount <> v_cash_amount
     or p_card_amount <> v_card_amount
     or p_paypay_amount <> v_paypay_amount
     or p_customer_count <> v_customer_count then
    raise exception 'sales details changed; reload and confirm again';
  end if;

  if p_total_amount <> v_cash_amount + v_card_amount + v_paypay_amount + p_manual_adjustment then
    raise exception 'sales total does not match breakdown';
  end if;

  -- 旧方式で同日のレコードが既にある場合は、最新の1件を引き継ぐ。
  select d.id into v_id
  from public.daily_sales_records d
  where d.cast_id = v_cast_id
    and d.date = p_date
  order by d.created_at desc
  limit 1
  for update;

  if v_id is not null then
    if exists (
      select 1
      from public.daily_sales_records d
      where d.id = v_id
        and d.status = 'confirmed'
    ) then
      raise exception 'confirmed sales cannot be resubmitted; contact store staff';
    end if;

    update public.daily_sales_records
    set store_id = v_store_id,
        cash_amount = p_cash_amount,
        card_amount = p_card_amount,
        paypay_amount = p_paypay_amount,
        total_amount = p_total_amount,
        customer_count = p_customer_count,
        manual_adjustment = p_manual_adjustment,
        notes = nullif(trim(coalesce(p_notes, '')), ''),
        status = 'pending',
        submission_key = v_key
    where id = v_id;
  else
    insert into public.daily_sales_records (
      date,
      cast_id,
      store_id,
      cash_amount,
      card_amount,
      paypay_amount,
      total_amount,
      customer_count,
      manual_adjustment,
      notes,
      status,
      submission_key
    ) values (
      p_date,
      v_cast_id,
      v_store_id,
      p_cash_amount,
      p_card_amount,
      p_paypay_amount,
      p_total_amount,
      p_customer_count,
      p_manual_adjustment,
      nullif(trim(coalesce(p_notes, '')), ''),
      'pending',
      v_key
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.get_therapist_daily_sales_submission(
  p_token text,
  p_date date
)
returns table (
  id uuid,
  status text,
  total_amount integer,
  submitted_at timestamptz,
  cash_amount integer,
  card_amount integer,
  paypay_amount integer,
  customer_count integer,
  manual_adjustment integer,
  notes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
  v_day_start time := '10:00:00';
  v_current_business_date date;
begin
  select c.id, c.store_id into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);
  v_current_business_date := case
    when (timezone('Asia/Tokyo', now()))::time < v_day_start
      then (timezone('Asia/Tokyo', now()))::date - 1
    else (timezone('Asia/Tokyo', now()))::date
  end;
  if p_date <> v_current_business_date then
    raise exception 'sales are available only for the current business day';
  end if;

  return query
  select
    d.id,
    d.status,
    d.total_amount,
    d.created_at,
    d.cash_amount,
    d.card_amount,
    d.paypay_amount,
    d.customer_count,
    coalesce(d.manual_adjustment, 0),
    d.notes
  from public.daily_sales_records d
  where d.cast_id = v_cast_id
    and d.date = p_date
  order by d.created_at desc
  limit 1;
end;
$$;

revoke execute on function public.therapist_update_reservation(
  text, uuid, text, integer, text, text[], integer, text[], integer, integer, text, text
) from public;
revoke execute on function public.therapist_update_payment_method(text, uuid, text) from public;
revoke execute on function public.get_therapist_daily_reservations(text, date) from public;
revoke execute on function public.get_therapist_sales_masters(text) from public;
revoke execute on function public.therapist_submit_daily_sales(
  text, date, integer, integer, integer, integer, integer, integer, text
) from public;
revoke execute on function public.get_therapist_daily_sales_submission(text, date) from public;

grant execute on function public.therapist_update_reservation(
  text, uuid, text, integer, text, text[], integer, text[], integer, integer, text, text
) to anon, authenticated;
grant execute on function public.therapist_update_payment_method(text, uuid, text) to anon, authenticated;
grant execute on function public.get_therapist_daily_reservations(text, date) to anon, authenticated;
grant execute on function public.get_therapist_sales_masters(text) to anon, authenticated;
grant execute on function public.therapist_submit_daily_sales(
  text, date, integer, integer, integer, integer, integer, integer, text
) to anon, authenticated;
grant execute on function public.get_therapist_daily_sales_submission(text, date) to anon, authenticated;

-- 日別予約情報から送った受付終了連絡の履歴。
create table if not exists public.therapist_reception_end_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cast_id uuid not null references public.casts(id) on delete cascade,
  business_date date not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id) on delete set null,
  unique (store_id, cast_id, business_date)
);

alter table public.therapist_reception_end_notifications enable row level security;

drop policy if exists therapist_reception_end_notifications_select
  on public.therapist_reception_end_notifications;
create policy therapist_reception_end_notifications_select
  on public.therapist_reception_end_notifications
  for select
  to authenticated
  using (public.can_manage_store(store_id));

revoke all on public.therapist_reception_end_notifications from anon;
grant select on public.therapist_reception_end_notifications to authenticated;
