-- 売上報告の承認と対象予約の完了を、同じトランザクションで確定する。
create or replace function public.confirm_daily_sales_report(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_cast_id uuid;
  v_initial_date date;
  v_report public.daily_sales_records%rowtype;
  v_day_start time := '10:00:00';
  v_lock_key text;
  v_completed_count integer := 0;
  v_cash_amount integer := 0;
  v_card_amount integer := 0;
  v_paypay_amount integer := 0;
  v_customer_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- 売上送信RPCと同じキーを作るため、まず対象だけを読み取る。
  select d.cast_id, d.date
    into v_initial_cast_id, v_initial_date
  from public.daily_sales_records d
  where d.id = p_report_id;

  if not found then
    raise exception 'sales report not found';
  end if;
  if v_initial_cast_id is null then
    raise exception 'sales report has no therapist';
  end if;

  v_lock_key := v_initial_cast_id::text || ':' || v_initial_date::text;
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- advisory lock取得後に行を固定し、承認条件を改めて検証する。
  select d.*
    into v_report
  from public.daily_sales_records d
  where d.id = p_report_id
  for update;

  if not found then
    raise exception 'sales report not found';
  end if;
  if v_report.cast_id is distinct from v_initial_cast_id
     or v_report.date is distinct from v_initial_date then
    raise exception 'sales report changed; retry';
  end if;
  if not public.can_manage_store(v_report.store_id) then
    raise exception 'permission denied';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'sales report is not pending';
  end if;
  if not exists (
    select 1
    from public.casts c
    where c.id = v_report.cast_id
      and c.store_id = v_report.store_id
  ) then
    raise exception 'sales report store does not match therapist';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_report.store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);

  -- 新ポータル経由の報告は、承認直前にも予約の最新内訳と一致するか確認する。
  -- 旧フォームの履歴はsubmission_keyが無いため、従来どおり承認できる。
  if v_report.submission_key is not null then
    with day_reservations as (
      select r.*
      from public.reservations r
      where r.store_id = v_report.store_id
        and r.cast_id = v_report.cast_id
        and r.status in ('confirmed', 'completed')
        and (
          (r.reservation_date = v_report.date and r.start_time >= v_day_start)
          or
          (r.reservation_date = v_report.date + 1 and r.start_time < v_day_start)
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
              where p.store_id = v_report.store_id
                and p.payment_method ~* '(card|クレジット|カード)'
            ), 0) / 100.0)
            when s.method = 'paypay' then round(s.base_amount * coalesce((
              select max(p.fee_percentage)
              from public.payment_settings p
              where p.store_id = v_report.store_id
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
    where r.store_id = v_report.store_id
      and r.cast_id = v_report.cast_id
      and r.status in ('confirmed', 'completed')
      and (
        (r.reservation_date = v_report.date and r.start_time >= v_day_start)
        or
        (r.reservation_date = v_report.date + 1 and r.start_time < v_day_start)
      );

    if v_report.cash_amount <> v_cash_amount
       or v_report.card_amount <> v_card_amount
       or v_report.paypay_amount <> v_paypay_amount
       or v_report.customer_count <> v_customer_count
       or v_report.total_amount <> v_cash_amount + v_card_amount + v_paypay_amount
          + coalesce(v_report.manual_adjustment, 0) then
      raise exception 'sales details changed; ask the therapist to confirm again';
    end if;
  end if;

  -- 営業日 = 当日営業開始以降 + 翌日営業開始前。
  -- 売上報告に含まれる確定予約だけを完了へ進める。
  update public.reservations r
  set status = 'completed',
      updated_at = now()
  where r.store_id = v_report.store_id
    and r.cast_id = v_report.cast_id
    and r.status = 'confirmed'
    and (
      (r.reservation_date = v_report.date and r.start_time >= v_day_start)
      or
      (r.reservation_date = v_report.date + 1 and r.start_time < v_day_start)
    );
  get diagnostics v_completed_count = row_count;

  update public.daily_sales_records
  set status = 'confirmed'
  where id = v_report.id
    and status = 'pending';

  if not found then
    raise exception 'sales report is not pending';
  end if;

  return v_completed_count;
end;
$$;

revoke all on function public.confirm_daily_sales_report(uuid) from public, anon;
grant execute on function public.confirm_daily_sales_report(uuid) to authenticated, service_role;
