-- Require an auditable consent source and expose duplicate-phone identity risk
-- to every CRM surface. Recommendations fail closed when identity is ambiguous.

alter table public.customer_profiles
  add column if not exists contact_consent_source text;

alter table public.customer_profiles
  drop constraint if exists customer_profiles_contact_permission_audit_check;

-- Older environments may already contain a bare `allowed` flag without an
-- auditable date/channel/source. Treat those rows as unconfirmed rather than
-- failing the migration or continuing to expose them to outreach.
update public.customer_profiles
set contact_permission = 'unknown'
where contact_permission = 'allowed'
  and (
    nullif(trim(preferred_contact_method), '') is null
    or contact_consent_at is null
    or nullif(trim(contact_consent_source), '') is null
  );

alter table public.customer_profiles
  add constraint customer_profiles_contact_permission_audit_check
  check (
    contact_permission <> 'allowed'
    or (
      nullif(trim(preferred_contact_method), '') is not null
      and contact_consent_at is not null
      and nullif(trim(contact_consent_source), '') is not null
    )
  );

comment on column public.customer_profiles.contact_consent_source is
  'Auditable source of consent, for example an in-store verbal confirmation or membership form.';

drop function if exists public.get_customer_crm_metrics(uuid[]);

create function public.get_customer_crm_metrics(p_customer_ids uuid[])
returns table(
  customer_id uuid,
  median_visit_interval_days integer,
  future_booking_date date,
  cancellation_rate numeric,
  favorite_course text,
  completed_visits_365d bigint,
  spend_365d bigint,
  latest_followup_date date,
  next_action_date date,
  identity_conflict boolean
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
      public.norm_phone(customer.phone) as phone_key,
      exists (
        select 1
        from public.customers as possible_duplicate
        where possible_duplicate.store_id = customer.store_id
          and possible_duplicate.id <> customer.id
          and public.norm_phone(possible_duplicate.phone) = public.norm_phone(customer.phone)
      ) as identity_conflict
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
    pending_actions.next_action_date,
    target.identity_conflict
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
  'Visible customers only: visit cycle, future booking, cancellation, course, unfinished follow-up and identity-conflict metrics for human-reviewed CRM suggestions.';

notify pgrst, 'reload schema';
