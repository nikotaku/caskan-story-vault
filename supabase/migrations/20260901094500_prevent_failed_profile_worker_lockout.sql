-- Profile workers must not reserve the shared Estama browser context until the
-- worker has authenticated successfully.  A failed Vercel boot (for example a
-- missing server secret) must therefore be unable to block the hourly
-- availability refresh.

create or replace function public.claim_estama_profile_worker_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_target_count integer := 0;
  v_owned_count integer := 0;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select token.token_hash
  into v_token_hash
  from public.estama_sync_tokens as token
  where token.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and token.purpose = 'profile-worker'
    and token.used_at is null
    and token.expires_at > now()
  for update;

  if v_token_hash is null then
    return false;
  end if;

  -- A request dispatched just before the quiet window may arrive late. Do not
  -- let that delayed worker overlap the hourly :40 availability refresh.
  if extract(minute from now()) between 27 and 42 then
    update public.estama_sync_tokens
    set used_at = now()
    where token_hash = v_token_hash;
    return false;
  end if;

  delete from private.estama_context_leases
  where expires_at <= now();

  select count(distinct job.store_id)
  into v_target_count
  from public.automation_jobs as job
  where job.provider = 'estama'
    and job.job_type = 'estama_register_cast'
    and job.status = 'queued'
    and job.available_at <= now();

  if v_target_count = 0 then
    update public.estama_sync_tokens
    set used_at = now()
    where token_hash = v_token_hash;
    return false;
  end if;

  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  )
  select distinct
    job.store_id,
    v_token_hash,
    'profile-worker',
    now(),
    now() + interval '6 minutes'
  from public.automation_jobs as job
  where job.provider = 'estama'
    and job.job_type = 'estama_register_cast'
    and job.status = 'queued'
    and job.available_at <= now()
  on conflict (store_id) do update
  set owner_token = excluded.owner_token,
      operation = excluded.operation,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where lease.expires_at <= now();

  select count(*)
  into v_owned_count
  from private.estama_context_leases as lease
  where lease.owner_token = v_token_hash
    and lease.operation = 'profile-worker'
    and lease.expires_at > now();

  if v_owned_count <> v_target_count then
    delete from private.estama_context_leases
    where owner_token = v_token_hash
      and operation = 'profile-worker';
    return false;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = v_token_hash
    and purpose = 'profile-worker'
    and used_at is null
    and expires_at > now();

  if not found then
    delete from private.estama_context_leases
    where owner_token = v_token_hash
      and operation = 'profile-worker';
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_estama_profile_worker_token(text)
  from public, anon, authenticated;
grant execute on function public.claim_estama_profile_worker_token(text)
  to service_role;

create or replace function public.release_estama_profile_worker_lease(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select token.token_hash
  into v_token_hash
  from public.estama_sync_tokens as token
  where token.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and token.purpose = 'profile-worker'
    and token.used_at is not null
    and token.expires_at > now();

  if v_token_hash is null then
    return false;
  end if;

  delete from private.estama_context_leases
  where owner_token = v_token_hash
    and operation = 'profile-worker';

  return found;
end;
$$;

revoke all on function public.release_estama_profile_worker_lease(text)
  from public, anon, authenticated;
grant execute on function public.release_estama_profile_worker_lease(text)
  to service_role;

create or replace function private.dispatch_estama_profile_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_request_id bigint;
begin
  delete from private.estama_context_leases
  where expires_at <= now();

  -- Remove reservations left by the previous dispatcher implementation only
  -- when no profile worker can still be using that store context.
  delete from private.estama_context_leases as lease
  where lease.operation = 'profile-dispatch-reservation'
    and lease.acquired_at < now() - interval '1 minute'
    and not exists (
      select 1
      from public.automation_jobs as job
      where job.store_id = lease.store_id
        and job.provider = 'estama'
        and job.job_type = 'estama_register_cast'
        and job.status = 'running'
        and coalesce(job.started_at, job.updated_at, job.created_at)
          > now() - interval '7 minutes'
    );

  update public.automation_jobs
  set status = 'queued',
      available_at = now(),
      error_message = '前回のプロフィール同期が中断されたため自動再開しました',
      started_at = null
  where provider = 'estama'
    and job_type = 'estama_register_cast'
    and status = 'running'
    and started_at < now() - interval '7 minutes';

  if exists (
    select 1
    from private.estama_context_leases as lease
    where lease.operation in ('hourly-availability-refresh', 'profile-worker')
      and lease.expires_at > now()
  ) then
    return null;
  end if;

  -- Reserve the hourly :40 availability slot. A five-minute worker can claim
  -- its final queued job just before termination; leave its seven-minute
  -- stale-job recovery plus one full cron tick before :40.
  if extract(minute from now()) between 27 and 42 then
    return null;
  end if;

  if exists (
    select 1
    from public.automation_jobs as job
    where job.provider = 'estama'
      and job.job_type = 'estama_register_cast'
      and job.status = 'running'
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.automation_jobs as job
    where job.provider = 'estama'
      and job.job_type = 'estama_register_cast'
      and job.status = 'queued'
      and job.available_at <= now()
  ) then
    return null;
  end if;

  -- A token that reached Vercel but was never claimed means the worker failed
  -- before touching Supabase. Keep the existing 15-minute retry cadence
  -- without using the shared browser-context lease as the backoff mechanism.
  if exists (
    select 1
    from public.estama_sync_tokens as token
    where token.purpose = 'profile-worker'
      and token.used_at is null
      and token.created_at > now() - interval '15 minutes'
  ) then
    return null;
  end if;

  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    encode(extensions.digest(v_raw_token, 'sha256'), 'hex'),
    'profile-worker',
    now() + interval '10 minutes'
  );

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/automations/estama-profile-worker',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', v_raw_token),
    timeout_milliseconds := 300000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_estama_profile_sync()
  from public, anon, authenticated;
grant execute on function private.dispatch_estama_profile_sync()
  to service_role;

-- Immediate, non-destructive recovery for reservations left by failed worker
-- boots. Queued jobs are intentionally preserved for a later retry.
delete from private.estama_context_leases as lease
where lease.operation = 'profile-dispatch-reservation'
  and lease.acquired_at < now() - interval '1 minute'
  and not exists (
    select 1
    from public.automation_jobs as job
    where job.store_id = lease.store_id
      and job.provider = 'estama'
      and job.job_type = 'estama_register_cast'
      and job.status = 'running'
      and coalesce(job.started_at, job.updated_at, job.created_at)
        > now() - interval '7 minutes'
  );
