create index if not exists dispatch_registrations_store_created_idx
  on public.dispatch_registrations (store_id, created_at desc);
create index if not exists dispatch_registrations_form_id_idx
  on public.dispatch_registrations (form_id);
