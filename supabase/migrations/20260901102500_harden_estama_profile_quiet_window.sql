-- Keep a database-level guard around the hourly :40 availability refresh even
-- if a delayed pg_net request reaches the profile worker after dispatch.

create or replace function private.block_estama_profile_lease_near_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.operation = 'profile-worker'
     and extract(minute from now()) between 27 and 42 then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function private.block_estama_profile_lease_near_availability()
  from public, anon, authenticated;

drop trigger if exists trg_block_estama_profile_lease_near_availability
  on private.estama_context_leases;

create trigger trg_block_estama_profile_lease_near_availability
before insert or update of owner_token, operation, acquired_at, expires_at
on private.estama_context_leases
for each row
execute function private.block_estama_profile_lease_near_availability();

-- Recover a profile job after the five-minute Vercel limit plus two minutes of
-- safety margin. This recovery runs independently of the dispatcher so its
-- quiet-window early return cannot leave a stale running row blocking :40.
create or replace function private.recover_stale_estama_profile_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recovered integer := 0;
begin
  update public.automation_jobs
  set status = 'queued',
      available_at = now(),
      error_message = '前回のプロフィール同期が中断されたため自動再開しました',
      started_at = null
  where provider = 'estama'
    and job_type = 'estama_register_cast'
    and status = 'running'
    and coalesce(started_at, updated_at, created_at)
      < now() - interval '7 minutes';

  get diagnostics v_recovered = row_count;
  return v_recovered;
end;
$$;

revoke all on function private.recover_stale_estama_profile_jobs()
  from public, anon, authenticated;
grant execute on function private.recover_stale_estama_profile_jobs()
  to service_role;

select private.recover_stale_estama_profile_jobs();

-- Guard the cron entry as well as the dispatcher function. This also applies
-- the wider quiet window to databases where the preceding migration had
-- already been installed with the older function body.
do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'estama-profile-sync-every-minute'
  ) then
    perform cron.unschedule('estama-profile-sync-every-minute');
  end if;

  perform cron.schedule(
    'estama-profile-sync-every-minute',
    '* * * * *',
    $cron$
      select case
        when extract(minute from now()) between 27 and 42 then null::bigint
        else private.dispatch_estama_profile_sync()
      end;
    $cron$
  );
end;
$$;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'estama-profile-stale-recovery-every-minute'
  ) then
    perform cron.unschedule('estama-profile-stale-recovery-every-minute');
  end if;

  perform cron.schedule(
    'estama-profile-stale-recovery-every-minute',
    '* * * * *',
    $cron$select private.recover_stale_estama_profile_jobs();$cron$
  );
end;
$$;
