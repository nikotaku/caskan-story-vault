-- Remove only the contact-consent fields that were added from an unrequested
-- interpretation. Keep the CRM metrics, follow-up workflow, preferences, and
-- cross-store integrity protections introduced by the preceding migrations.

lock table public.customer_profiles in access exclusive mode;

do $rollback_guard$
declare
  v_meaningful_rows bigint;
begin
  select count(*)
  into v_meaningful_rows
  from public.customer_profiles
  where contact_permission is distinct from 'unknown'
     or preferred_contact_method is not null
     or contact_consent_at is not null
     or preferred_contact_time is not null
     or contact_consent_source is not null;

  if v_meaningful_rows > 0 then
    raise exception
      'Rollback stopped: % customer profile row(s) contain non-default contact-consent data.',
      v_meaningful_rows;
  end if;
end
$rollback_guard$;

alter table public.customer_profiles
  drop constraint if exists customer_profiles_contact_permission_audit_check,
  drop constraint if exists customer_profiles_contact_permission_check;

alter table public.customer_profiles
  drop column if exists contact_permission,
  drop column if exists preferred_contact_method,
  drop column if exists contact_consent_at,
  drop column if exists preferred_contact_time,
  drop column if exists contact_consent_source;

notify pgrst, 'reload schema';
