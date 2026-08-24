-- 顧客管理アップデート:
-- 1) 顧客詳細RPCの店舗越境を防止
-- 2) 来店周期・将来予約・キャンセル率・好みを一括計算
-- 3) 顧客一覧／電話番号照合向けの索引を追加

create or replace function public.get_customer_reservations(p_customer_id uuid)
returns table(
  id uuid,
  reservation_date text,
  start_time text,
  course_name text,
  options text[],
  nomination_type text,
  price integer,
  discount integer,
  status text,
  cast_name text,
  notes text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with target as (
    select
      customer.store_id,
      public.norm_phone(customer.phone) as phone_key
    from public.customers as customer
    where customer.id = p_customer_id
      and length(public.norm_phone(customer.phone)) >= 10
  )
  select
    reservation.id,
    reservation.reservation_date::text,
    left(reservation.start_time::text, 5),
    reservation.course_name,
    reservation.options,
    reservation.nomination_type,
    reservation.price,
    reservation.discount,
    reservation.status,
    cast_member.name as cast_name,
    reservation.notes
  from target
  join public.reservations as reservation
    on reservation.store_id = target.store_id
   and public.norm_phone(reservation.customer_phone) = target.phone_key
  left join public.casts as cast_member
    on cast_member.id = reservation.cast_id
   and cast_member.store_id = target.store_id
  order by reservation.reservation_date desc, reservation.start_time desc
  limit 500
$function$;

revoke all on function public.get_customer_reservations(uuid) from public, anon;
grant execute on function public.get_customer_reservations(uuid) to authenticated;

-- These two functions are internal trigger helpers and must not be callable
-- directly with user-supplied store IDs or phone numbers.
revoke all on function public.sync_customer_stats_for(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.trg_sync_customer_stats()
  from public, anon, authenticated;

create or replace function public.get_customer_crm_metrics(p_customer_ids uuid[])
returns table(
  customer_id uuid,
  median_visit_interval_days integer,
  future_booking_date date,
  cancellation_rate numeric,
  favorite_course text,
  completed_visits_365d bigint,
  spend_365d bigint,
  latest_followup_date date,
  next_action_date date
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with target as (
    select
      customer.id as customer_id,
      customer.store_id,
      public.norm_phone(customer.phone) as phone_key
    from public.customers as customer
    where customer.id = any(coalesce(p_customer_ids, '{}'::uuid[]))
      and length(public.norm_phone(customer.phone)) >= 10
  ),
  all_reservations as (
    select
      target.customer_id,
      reservation.reservation_date,
      reservation.start_time,
      reservation.status,
      reservation.course_name,
      reservation.price
    from target
    join public.reservations as reservation
      on reservation.store_id = target.store_id
     and public.norm_phone(reservation.customer_phone) = target.phone_key
  ),
  visit_days as (
    select distinct customer_id, reservation_date
    from all_reservations
    where status = 'completed'
  ),
  visit_gaps as (
    select
      customer_id,
      reservation_date - lag(reservation_date) over (
        partition by customer_id
        order by reservation_date
      ) as gap_days
    from visit_days
  ),
  median_intervals as (
    select
      customer_id,
      (percentile_disc(0.5) within group (order by gap_days))::integer as median_days
    from visit_gaps
    where gap_days is not null
    group by customer_id
  ),
  reservation_metrics as (
    select
      customer_id,
      round(
        count(*) filter (where status = 'cancelled')::numeric
        / nullif(count(*) filter (where status in ('completed', 'cancelled')), 0),
        3
      ) as cancel_rate,
      count(*) filter (
        where status = 'completed'
          and reservation_date >= (now() at time zone 'Asia/Tokyo')::date - 365
      ) as visits_365d,
      coalesce(sum(price) filter (
        where status = 'completed'
          and reservation_date >= (now() at time zone 'Asia/Tokyo')::date - 365
      ), 0)::bigint as amount_365d
    from all_reservations
    group by customer_id
  ),
  future_reservations as (
    select
      customer_id,
      reservation_date,
      row_number() over (
        partition by customer_id
        order by reservation_date, start_time
      ) as row_number
    from all_reservations
    where status in ('pending', 'sms_waiting', 'confirmed')
      and reservation_date >= (now() at time zone 'Asia/Tokyo')::date
  ),
  course_counts as (
    select
      customer_id,
      course_name,
      count(*) as uses,
      max(reservation_date) as latest_visit
    from all_reservations
    where status = 'completed'
      and nullif(trim(course_name), '') is not null
    group by customer_id, course_name
  ),
  ranked_courses as (
    select
      customer_id,
      course_name,
      row_number() over (
        partition by customer_id
        order by uses desc, latest_visit desc, course_name
      ) as row_number
    from course_counts
  ),
  latest_followups as (
    select distinct on (followup.customer_id)
      followup.customer_id,
      followup.followup_date,
      followup.next_action_date
    from public.customer_followups as followup
    join target on target.customer_id = followup.customer_id
    order by followup.customer_id, followup.followup_date desc, followup.created_at desc
  )
  select
    target.customer_id,
    median_intervals.median_days,
    future_reservations.reservation_date,
    reservation_metrics.cancel_rate,
    ranked_courses.course_name,
    coalesce(reservation_metrics.visits_365d, 0),
    coalesce(reservation_metrics.amount_365d, 0),
    latest_followups.followup_date,
    latest_followups.next_action_date
  from target
  left join median_intervals using (customer_id)
  left join reservation_metrics using (customer_id)
  left join future_reservations
    on future_reservations.customer_id = target.customer_id
   and future_reservations.row_number = 1
  left join ranked_courses
    on ranked_courses.customer_id = target.customer_id
   and ranked_courses.row_number = 1
  left join latest_followups
    on latest_followups.customer_id = target.customer_id
  order by target.customer_id
$function$;

revoke all on function public.get_customer_crm_metrics(uuid[]) from public, anon;
grant execute on function public.get_customer_crm_metrics(uuid[]) to authenticated;

create index if not exists idx_customers_crm_phone
  on public.customers (store_id, (public.norm_phone(phone)))
  where length(public.norm_phone(phone)) >= 10;

create index if not exists idx_reservations_crm_phone_date
  on public.reservations (
    store_id,
    (public.norm_phone(customer_phone)),
    reservation_date desc,
    start_time desc
  )
  include (status, price, course_name, cast_id);

create index if not exists idx_customers_crm_last_visit
  on public.customers (store_id, last_visited desc nulls last, id);

create index if not exists idx_customers_crm_visit_count
  on public.customers (store_id, visit_count desc nulls last, id);

create index if not exists idx_customers_crm_total_spent
  on public.customers (store_id, total_spent desc, id);

create index if not exists idx_customer_followups_crm_latest
  on public.customer_followups (store_id, customer_id, followup_date desc, created_at desc);

comment on function public.get_customer_crm_metrics(uuid[]) is
  'Visible customers only: visit cycle, future booking, cancellation, course and follow-up metrics for human-reviewed CRM suggestions.';
