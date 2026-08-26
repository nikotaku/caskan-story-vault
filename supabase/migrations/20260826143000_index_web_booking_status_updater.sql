create index if not exists idx_reservations_web_booking_status_updated_by
  on public.reservations (web_booking_status_updated_by)
  where web_booking_status_updated_by is not null;
