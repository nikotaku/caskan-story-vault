-- Let the status RPC run as its caller. The manager-only row policy supplies
-- the permission needed on clean replays without granting definer privileges.
drop policy if exists "Web booking managers can update handling status"
  on public.reservations;
create policy "Web booking managers can update handling status"
  on public.reservations
  for update
  to authenticated
  using (
    booking_origin in ('web_form', 'cast_form')
    and public.can_manage_store(store_id)
  )
  with check (
    booking_origin in ('web_form', 'cast_form')
    and public.can_manage_store(store_id)
  );

grant update (web_booking_status) on public.reservations to authenticated;

alter function public.update_web_booking_status(uuid, uuid, text)
  security invoker;
