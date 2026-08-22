revoke all on public.dispatch_registration_forms from anon, authenticated;
revoke all on public.dispatch_registrations from anon, authenticated;

grant select, insert, update on public.dispatch_registration_forms to authenticated;
grant select, update, delete on public.dispatch_registrations to authenticated;

grant all on public.dispatch_registration_forms to service_role;
grant all on public.dispatch_registrations to service_role;
