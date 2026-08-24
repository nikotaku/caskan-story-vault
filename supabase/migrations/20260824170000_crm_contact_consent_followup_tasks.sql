-- CRM consent and follow-up task safeguards:
-- 1) Keep outbound-contact consent explicit (unknown by default).
-- 2) Store the preferred channel/time and the date consent was confirmed.
-- 3) Track follow-up task completion independently from the latest contact log.

alter table public.customer_profiles
  add column if not exists contact_permission text not null default 'unknown',
  add column if not exists preferred_contact_method text,
  add column if not exists contact_consent_at date,
  add column if not exists preferred_contact_time text;

alter table public.customer_profiles
  drop constraint if exists customer_profiles_contact_permission_check;

alter table public.customer_profiles
  add constraint customer_profiles_contact_permission_check
  check (contact_permission in ('unknown', 'allowed', 'denied'));

comment on column public.customer_profiles.contact_permission is
  'Explicit outbound-contact status. Unknown and denied customers must not receive CRM message suggestions.';

alter table public.customer_followups
  add column if not exists completed_at timestamptz;

create index if not exists idx_customer_followups_pending_action
  on public.customer_followups (store_id, next_action_date, customer_id)
  where next_action_date is not null and completed_at is null;

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
          and reservation_date > (now() at time zone 'Asia/Tokyo')::date - 365
      ) as visits_365d,
      coalesce(sum(price) filter (
        where status = 'completed'
          and reservation_date > (now() at time zone 'Asia/Tokyo')::date - 365
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
      followup.followup_date
    from public.customer_followups as followup
    join target on target.customer_id = followup.customer_id
    order by followup.customer_id, followup.followup_date desc, followup.created_at desc
  ),
  pending_actions as (
    select
      followup.customer_id,
      min(followup.next_action_date) as next_action_date
    from public.customer_followups as followup
    join target on target.customer_id = followup.customer_id
    where followup.next_action_date is not null
      and followup.completed_at is null
    group by followup.customer_id
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
    pending_actions.next_action_date
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
  left join pending_actions
    on pending_actions.customer_id = target.customer_id
  order by target.customer_id
$function$;

revoke all on function public.get_customer_crm_metrics(uuid[]) from public, anon;
grant execute on function public.get_customer_crm_metrics(uuid[]) to authenticated;

comment on function public.get_customer_crm_metrics(uuid[]) is
  'Visible customers only: visit cycle, future booking, cancellation, course and unfinished follow-up metrics for human-reviewed CRM suggestions.';
