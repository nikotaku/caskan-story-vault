-- Track the origin of reservations and human handling state for public forms.
-- Reservation lifecycle status (pending/confirmed/completed/cancelled) remains separate.
alter table public.reservations
  add column if not exists booking_origin text not null default 'legacy_unknown',
  add column if not exists web_booking_status text,
  add column if not exists web_booking_status_updated_at timestamptz,
  add column if not exists web_booking_status_updated_by uuid references auth.users(id) on delete set null;

-- Existing authenticated rows are reliably staff-created.
update public.reservations
set booking_origin = 'staff',
    web_booking_status = null,
    web_booking_status_updated_at = null,
    web_booking_status_updated_by = null
where booking_origin = 'legacy_unknown'
  and created_by is not null;

-- A null creator is not sufficient evidence: legacy CSV imports also omitted it.
-- Notification attempts are the reliable marker for past public-form submissions.
update public.reservations
set booking_origin = case
      when coalesce(referral_source, '') like '%専用フォーム%' then 'cast_form'
      else 'web_form'
    end,
    web_booking_status = 'unhandled',
    web_booking_status_updated_at = null,
    web_booking_status_updated_by = null
where booking_origin = 'legacy_unknown'
  and created_by is null
  and (
    notification_attempt_count > 0
    or line_notification_status <> 'not_attempted'
    or email_notification_status <> 'not_attempted'
  );

alter table public.reservations
  drop constraint if exists reservations_booking_origin_check,
  drop constraint if exists reservations_web_booking_status_check,
  drop constraint if exists reservations_web_booking_consistency_check,
  drop constraint if exists reservations_web_booking_audit_check;

alter table public.reservations
  add constraint reservations_booking_origin_check
    check (booking_origin in ('legacy_unknown', 'web_form', 'cast_form', 'staff', 'csv_import')),
  add constraint reservations_web_booking_status_check
    check (web_booking_status is null or web_booking_status in ('unhandled', 'in_progress', 'handled')),
  add constraint reservations_web_booking_consistency_check
    check (
      (booking_origin in ('web_form', 'cast_form') and web_booking_status in ('unhandled', 'in_progress', 'handled'))
      or
      (booking_origin not in ('web_form', 'cast_form') and web_booking_status is null)
    ),
  add constraint reservations_web_booking_audit_check
    check (
      (web_booking_status in ('in_progress', 'handled') and web_booking_status_updated_at is not null)
      or
      ((web_booking_status is null or web_booking_status = 'unhandled')
        and web_booking_status_updated_at is null
        and web_booking_status_updated_by is null)
    );

-- Normalize metadata before RLS checks. Old public clients remain compatible,
-- while anonymous callers cannot spoof a handled state.
create or replace function public.normalize_reservation_booking_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if tg_op = 'INSERT' and request_role = 'anon' then
    new.booking_origin := case
      when coalesce(new.referral_source, '') like '%専用フォーム%' then 'cast_form'
      else 'web_form'
    end;
    new.web_booking_status := 'unhandled';
    new.web_booking_status_updated_at := null;
    new.web_booking_status_updated_by := null;
  elsif tg_op = 'INSERT'
    and new.booking_origin = 'legacy_unknown'
    and new.created_by is not null then
    new.booking_origin := 'staff';
    new.web_booking_status := null;
  end if;

  if new.booking_origin not in ('web_form', 'cast_form') then
    new.web_booking_status := null;
    new.web_booking_status_updated_at := null;
    new.web_booking_status_updated_by := null;
  elsif new.web_booking_status = 'unhandled' then
    new.web_booking_status_updated_at := null;
    new.web_booking_status_updated_by := null;
  elsif new.web_booking_status in ('in_progress', 'handled') then
    if tg_op = 'INSERT'
      or old.web_booking_status is distinct from new.web_booking_status then
      new.web_booking_status_updated_at := now();
      new.web_booking_status_updated_by := auth.uid();
    else
      new.web_booking_status_updated_at :=
        coalesce(new.web_booking_status_updated_at, old.web_booking_status_updated_at, now());
      new.web_booking_status_updated_by :=
        coalesce(new.web_booking_status_updated_by, old.web_booking_status_updated_by, auth.uid());
    end if;
  else
    raise exception 'Web reservations require a valid handling status';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_reservation_booking_metadata()
  from public, anon, authenticated;

drop trigger if exists trg_normalize_reservation_booking_metadata on public.reservations;
create trigger trg_normalize_reservation_booking_metadata
before insert or update of booking_origin, web_booking_status,
  web_booking_status_updated_at, web_booking_status_updated_by
on public.reservations
for each row execute function public.normalize_reservation_booking_metadata();

create index if not exists idx_reservations_web_booking_inbox
  on public.reservations (store_id, web_booking_status, created_at desc)
  where booking_origin in ('web_form', 'cast_form');

drop policy if exists "Public can insert reservations" on public.reservations;
create policy "Public can insert reservations"
  on public.reservations
  for insert
  to anon
  with check (
    created_by is null
    and booking_origin in ('web_form', 'cast_form')
    and web_booking_status = 'unhandled'
    and web_booking_status_updated_at is null
    and web_booking_status_updated_by is null
  );

revoke select, update, delete on table public.reservations from anon;
grant insert on table public.reservations to anon;

comment on column public.reservations.booking_origin is
  'Reservation entry path: web_form, cast_form, staff, csv_import, or legacy_unknown.';
comment on column public.reservations.web_booking_status is
  'Human response state for public form reservations; independent from reservation lifecycle status.';

notify pgrst, 'reload schema';
