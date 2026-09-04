-- セラピストの精算保存と、その営業日の予約完了を同じトランザクションで確定する。
create or replace function public.complete_daily_clearance(
  p_cast_id uuid,
  p_date date,
  p_total_sales integer,
  p_therapist_back integer,
  p_misc_expenses integer,
  p_accommodation_fee integer,
  p_transportation_fee integer,
  p_other_expenses jsonb,
  p_payout_amount integer,
  p_payout_method text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_day_start time := '10:00:00';
  v_completed_count integer := 0;
  v_current_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select c.store_id
    into v_store_id
  from public.casts c
  where c.id = p_cast_id;

  if not found or not public.can_manage_store(v_store_id) then
    raise exception 'permission denied';
  end if;

  if p_date is null
     or p_total_sales is null
     or p_therapist_back is null
     or p_misc_expenses is null
     or p_accommodation_fee is null
     or p_transportation_fee is null
     or p_payout_amount is null
     or p_total_sales < 0
     or p_therapist_back < 0
     or p_misc_expenses < 0
     or p_accommodation_fee < 0
     or p_transportation_fee < 0 then
    raise exception 'invalid clearance amount';
  end if;

  select coalesce(nullif(s.business_day_start, '')::time, '10:00:00'::time)
    into v_day_start
  from public.shop_settings s
  where s.store_id = v_store_id
  limit 1;
  v_day_start := coalesce(v_day_start, '10:00:00'::time);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_cast_id::text || ':' || p_date::text, 0)
  );

  -- 画面を開いた後に予約金額が変わっていた場合は、再読込を促して古い額で清算しない。
  select coalesce(sum(coalesce(r.price, 0) + coalesce(r.payment_fee, 0)), 0)::integer
    into v_current_total
  from public.reservations r
  where r.store_id = v_store_id
    and r.cast_id = p_cast_id
    and r.status in ('confirmed', 'completed')
    and (
      (r.reservation_date = p_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = p_date + 1 and r.start_time < v_day_start)
    );

  if p_total_sales <> v_current_total then
    raise exception 'reservation totals changed; reload and confirm again';
  end if;

  update public.reservations r
  set status = 'completed',
      updated_at = now()
  where r.store_id = v_store_id
    and r.cast_id = p_cast_id
    and r.status = 'confirmed'
    and (
      (r.reservation_date = p_date and r.start_time >= v_day_start)
      or
      (r.reservation_date = p_date + 1 and r.start_time < v_day_start)
    );
  get diagnostics v_completed_count = row_count;

  -- 日別精算を最終確認として、同日の精算入力も確認済みに揃える。
  update public.daily_sales_records d
  set status = 'confirmed'
  where d.store_id = v_store_id
    and d.cast_id = p_cast_id
    and d.date = p_date
    and d.status = 'pending';

  insert into public.daily_clearances (
    cast_id,
    date,
    total_sales,
    therapist_back,
    misc_expenses,
    accommodation_fee,
    transportation_fee,
    other_expenses,
    payout_amount,
    payout_method,
    status,
    points_awarded,
    cleared_at,
    store_id
  ) values (
    p_cast_id,
    p_date,
    p_total_sales,
    p_therapist_back,
    p_misc_expenses,
    p_accommodation_fee,
    p_transportation_fee,
    coalesce(p_other_expenses, '[]'::jsonb),
    p_payout_amount,
    nullif(trim(coalesce(p_payout_method, '')), ''),
    'pending',
    0.5,
    now(),
    v_store_id
  )
  on conflict (cast_id, date) do update
  set total_sales = excluded.total_sales,
      therapist_back = excluded.therapist_back,
      misc_expenses = excluded.misc_expenses,
      accommodation_fee = excluded.accommodation_fee,
      transportation_fee = excluded.transportation_fee,
      other_expenses = excluded.other_expenses,
      payout_amount = excluded.payout_amount,
      payout_method = excluded.payout_method,
      status = 'pending',
      points_awarded = excluded.points_awarded,
      cleared_at = excluded.cleared_at,
      store_id = excluded.store_id;

  return v_completed_count;
end;
$$;

comment on function public.complete_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, integer, text
) is '日別精算を保存し、同じ営業日・セラピストの確定予約を完了へ進める。';

revoke all on function public.complete_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, integer, text
) from public, anon;
grant execute on function public.complete_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, integer, text
) to authenticated, service_role;
