-- Preserve ON DELETE SET NULL for the audit user foreign key.
-- On ordinary updates, NEW already carries the previous updater when the
-- column is untouched, so falling back to OLD would incorrectly undo an
-- explicit null set by the foreign-key action.
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
        coalesce(new.web_booking_status_updated_by, auth.uid());
    end if;
  else
    raise exception 'Web reservations require a valid handling status';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_reservation_booking_metadata()
  from public, anon, authenticated;
