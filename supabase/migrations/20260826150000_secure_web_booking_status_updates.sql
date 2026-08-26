-- Remove the original permissive public insert policy on clean replays.
-- PostgreSQL combines permissive policies with OR, so leaving this policy in
-- place would bypass the stricter anonymous form policy added above.
drop policy if exists "Anyone can create reservations" on public.reservations;

create or replace function public.update_web_booking_status(
  p_reservation_id uuid,
  p_store_id uuid,
  p_status text
)
returns table (
  id uuid,
  web_booking_status text,
  web_booking_status_updated_at timestamptz,
  web_booking_status_updated_by uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'Store manager access is required'
      using errcode = '42501';
  end if;

  if p_status not in ('unhandled', 'in_progress', 'handled') then
    raise exception 'Invalid web booking status'
      using errcode = '22023';
  end if;

  return query
  update public.reservations as reservation
  set web_booking_status = p_status
  where reservation.id = p_reservation_id
    and reservation.store_id = p_store_id
    and reservation.booking_origin in ('web_form', 'cast_form')
  returning
    reservation.id,
    reservation.web_booking_status,
    reservation.web_booking_status_updated_at,
    reservation.web_booking_status_updated_by;

  if not found then
    raise exception 'Web booking not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_web_booking_status(uuid, uuid, text)
  from public, anon;
grant execute on function public.update_web_booking_status(uuid, uuid, text)
  to authenticated;

comment on function public.update_web_booking_status(uuid, uuid, text) is
  'Updates the human handling state of a form reservation for its store manager.';
