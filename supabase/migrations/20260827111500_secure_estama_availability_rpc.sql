-- 毎時のご案内状況更新は、Vercelへ管理鍵を渡さず、一回限りの
-- dispatcher token と短時間だけ有効な run token で実行する。

create table if not exists private.estama_availability_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique,
  dispatch_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists estama_availability_runs_expires_idx
  on private.estama_availability_runs (expires_at);

create table if not exists private.estama_availability_run_stores (
  run_id uuid not null references private.estama_availability_runs(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  report_id uuid not null references public.estama_sync_reports(id) on delete cascade,
  completed_at timestamptz,
  primary key (run_id, store_id),
  unique (report_id)
);

revoke all on table private.estama_availability_runs
  from public, anon, authenticated;
revoke all on table private.estama_availability_run_stores
  from public, anon, authenticated;

create or replace function public.claim_estama_availability_run(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch_hash text;
  v_run_token text;
  v_run_hash text;
  v_run_id uuid;
  v_connections jsonb := '[]'::jsonb;
  v_deferred_count integer := 0;
  v_overflow_count integer := 0;
  v_unavailable_count integer := 0;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and purpose = 'availability-refresh'
    and used_at is null
    and expires_at > now()
  returning token_hash into v_dispatch_hash;

  if v_dispatch_hash is null then
    return null;
  end if;

  delete from private.estama_availability_runs
  where expires_at <= now();
  delete from private.estama_context_leases
  where expires_at <= now();

  v_run_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_run_hash := encode(extensions.digest(v_run_token, 'sha256'), 'hex');
  insert into private.estama_availability_runs (
    token_hash,
    dispatch_token_hash,
    expires_at
  ) values (
    v_run_hash,
    v_dispatch_hash,
    now() + interval '20 minutes'
  )
  returning id into v_run_id;

  insert into private.estama_availability_run_stores (run_id, store_id, report_id)
  select v_run_id, report.store_id, report.id
  from public.estama_sync_reports as report
  where report.results @> jsonb_build_object(
    'kind', 'availability_refresh',
    'dispatch_token_hash', v_dispatch_hash
  )
  on conflict (run_id, store_id) do nothing;

  update public.estama_sync_reports as report
  set status = 'error',
      finished_at = now(),
      summary = '⚠️ エスたま ご案内状況を更新できませんでした。' || E'\n'
        || 'エスたま接続が再ログイン待ち、または自動更新対象外です。',
      fatal_error = 'エスたま接続が再ログイン待ち、または自動更新対象外です'
  where report.results @> jsonb_build_object(
      'kind', 'availability_refresh',
      'dispatch_token_hash', v_dispatch_hash
    )
    and not exists (
      select 1
      from public.automation_connections as connection
      where connection.store_id = report.store_id
        and connection.provider = 'estama'
        and connection.status = 'ready'
        and connection.browserbase_context_id is not null
    );
  get diagnostics v_unavailable_count = row_count;

  update public.estama_sync_reports as report
  set status = 'warning',
      finished_at = now(),
      summary = '⚠️ エスたま ご案内状況の更新を延期' || E'\n'
        || '別のエスたま同期が実行中のため、次回の毎時実行で自動再試行します。',
      fatal_error = null
  where report.results @> jsonb_build_object(
      'kind', 'availability_refresh',
      'dispatch_token_hash', v_dispatch_hash
    )
    and exists (
      select 1
      from public.automation_connections as connection
      where connection.store_id = report.store_id
        and connection.provider = 'estama'
        and connection.status = 'ready'
        and connection.browserbase_context_id is not null
    )
    and (
      exists (
        select 1
        from public.automation_jobs as job
        where job.store_id = report.store_id
          and job.provider = 'estama'
          and job.status = 'running'
          and coalesce(job.started_at, job.updated_at, job.created_at)
            > now() - case
              when job.job_type = 'estama_sync_shift' then interval '3 hours'
              else interval '15 minutes'
            end
      )
      or exists (
        select 1
        from private.estama_context_leases as lease
        where lease.store_id = report.store_id
          and lease.expires_at > now()
      )
    );
  get diagnostics v_deferred_count = row_count;

  -- 対象storeをrun tokenへ先に予約する。VercelがBrowserbaseを開くまでの間に
  -- 毎分プロフィール同期が割り込まないよう、HTTP処理より前にロックを確定する。
  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  )
  select
    candidate.store_id,
    v_run_hash,
    'hourly-availability-refresh',
    now(),
    now() + interval '6 minutes'
  from (
    select connection.store_id
    from public.automation_connections as connection
    where connection.provider = 'estama'
      and connection.status = 'ready'
      and connection.browserbase_context_id is not null
      and exists (
        select 1
        from private.estama_availability_run_stores as run_store
        where run_store.run_id = v_run_id
          and run_store.store_id = connection.store_id
      )
      and not exists (
        select 1
        from public.automation_jobs as job
        where job.store_id = connection.store_id
          and job.provider = 'estama'
          and job.status = 'running'
          and coalesce(job.started_at, job.updated_at, job.created_at)
            > now() - case
              when job.job_type = 'estama_sync_shift' then interval '3 hours'
              else interval '15 minutes'
            end
      )
      and not exists (
        select 1
        from private.estama_context_leases as active_lease
        where active_lease.store_id = connection.store_id
          and active_lease.expires_at > now()
      )
    order by nullif(
      connection.configuration #>> '{availability_refresh,last_run_at}',
      ''
    ) nulls first,
    connection.created_at
    limit 10
  ) as candidate
  on conflict (store_id) do update
  set owner_token = excluded.owner_token,
      operation = excluded.operation,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where lease.expires_at <= now();

  update public.estama_sync_reports as report
  set status = 'warning',
      finished_at = now(),
      summary = '⚠️ エスたま ご案内状況の更新を延期' || E'\n'
        || '同時実行数の上限、または別のエスたま同期のため、次回の毎時実行で再試行します。',
      fatal_error = null
  where report.summary = '⏳ エスたま ご案内状況の毎時更新を開始しました。'
    and exists (
      select 1
      from private.estama_availability_run_stores as run_store
      where run_store.run_id = v_run_id
        and run_store.store_id = report.store_id
        and run_store.report_id = report.id
    )
    and not exists (
      select 1
      from private.estama_context_leases as lease
      where lease.store_id = report.store_id
        and lease.owner_token = v_run_hash
        and lease.expires_at > now()
    );
  get diagnostics v_overflow_count = row_count;
  v_deferred_count := v_deferred_count + v_overflow_count;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', connection.id,
        'store_id', connection.store_id,
        'status', connection.status,
        'browserbase_context_id', connection.browserbase_context_id,
        'setup_session_id', connection.setup_session_id,
        'shop_id', connection.shop_id,
        'configuration', connection.configuration
      ) order by connection.created_at
    ),
    '[]'::jsonb
  )
  into v_connections
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null
    and exists (
      select 1
      from private.estama_availability_run_stores as run_store
      where run_store.run_id = v_run_id
        and run_store.store_id = connection.store_id
    )
    and not exists (
      select 1
      from public.automation_jobs as job
      where job.store_id = connection.store_id
        and job.provider = 'estama'
        and job.status = 'running'
        and coalesce(job.started_at, job.updated_at, job.created_at)
          > now() - case
            when job.job_type = 'estama_sync_shift' then interval '3 hours'
            else interval '15 minutes'
          end
    )
    and exists (
      select 1
      from private.estama_context_leases as lease
      where lease.store_id = connection.store_id
        and lease.owner_token = v_run_hash
        and lease.expires_at > now()
    );

  return jsonb_build_object(
    'runToken', v_run_token,
    'connections', v_connections,
    'deferredCount', v_deferred_count,
    'unavailableCount', v_unavailable_count
  );
end;
$$;

revoke all on function public.claim_estama_availability_run(text)
  from public, anon, authenticated;
grant execute on function public.claim_estama_availability_run(text)
  to anon, authenticated, service_role;

create or replace function public.claim_estama_availability_lease(
  p_run_token text,
  p_store_id uuid,
  p_owner_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_run_hash text;
  v_rows integer;
begin
  if p_store_id is null
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_owner_token, '')) < 16 then
    return false;
  end if;

  select run.id, run.token_hash
  into v_run_id, v_run_hash
  from private.estama_availability_runs as run
  where run.token_hash = encode(extensions.digest(p_run_token, 'sha256'), 'hex')
    and run.expires_at > now();

  if v_run_id is null
     or not exists (
       select 1
       from private.estama_availability_run_stores as run_store
       where run_store.run_id = v_run_id
         and run_store.store_id = p_store_id
     )
     or exists (
       select 1
       from public.automation_jobs as job
       where job.store_id = p_store_id
         and job.provider = 'estama'
         and job.status = 'running'
         and coalesce(job.started_at, job.updated_at, job.created_at)
           > now() - case
             when job.job_type = 'estama_sync_shift' then interval '3 hours'
             else interval '15 minutes'
           end
     ) then
    delete from private.estama_context_leases
    where store_id = p_store_id
      and owner_token = v_run_hash;
    return false;
  end if;

  update private.estama_context_leases as lease
  set owner_token = p_owner_token,
      acquired_at = now(),
      expires_at = now() + interval '6 minutes'
  where lease.store_id = p_store_id
    and lease.expires_at > now()
    and lease.owner_token in (v_run_hash, p_owner_token);

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.claim_estama_availability_lease(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_estama_availability_lease(text, uuid, text)
  to anon, authenticated, service_role;

create or replace function public.release_estama_availability_lease(
  p_run_token text,
  p_store_id uuid,
  p_owner_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  if p_store_id is null
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_owner_token, '')) < 16 then
    return false;
  end if;

  select run.id
  into v_run_id
  from private.estama_availability_runs as run
  where run.token_hash = encode(extensions.digest(p_run_token, 'sha256'), 'hex')
    and run.expires_at > now();

  if v_run_id is null
     or not exists (
       select 1
       from private.estama_availability_run_stores as run_store
       where run_store.run_id = v_run_id
         and run_store.store_id = p_store_id
     ) then
    return false;
  end if;

  delete from private.estama_context_leases
  where store_id = p_store_id
    and owner_token = p_owner_token;
  return found;
end;
$$;

revoke all on function public.release_estama_availability_lease(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.release_estama_availability_lease(text, uuid, text)
  to anon, authenticated, service_role;

create or replace function public.save_estama_availability_result(
  p_run_token text,
  p_store_id uuid,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_report_id uuid;
  v_completed_at timestamptz;
  v_status text;
  v_total_count integer := 0;
  v_success_count integer := 0;
  v_cast_names text[] := array[]::text[];
  v_results jsonb := '[]'::jsonb;
  v_configuration jsonb := '{}'::jsonb;
begin
  if p_store_id is null
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$'
     or p_payload is null
     or jsonb_typeof(p_payload) is distinct from 'object'
     or octet_length(p_payload::text) > 100000 then
    return false;
  end if;

  select run.id, run_store.report_id, run_store.completed_at
  into v_run_id, v_report_id, v_completed_at
  from private.estama_availability_runs as run
  join private.estama_availability_run_stores as run_store
    on run_store.run_id = run.id
   and run_store.store_id = p_store_id
  where run.token_hash = encode(extensions.digest(p_run_token, 'sha256'), 'hex')
    and run.expires_at > now()
  for update of run_store;

  if v_run_id is null or v_report_id is null then
    return false;
  end if;
  if v_completed_at is not null then
    return true;
  end if;

  v_status := case p_payload ->> 'reportStatus'
    when 'success' then 'success'
    when 'warning' then 'warning'
    else 'error'
  end;

  if coalesce(p_payload ->> 'totalCount', '') ~ '^\d{1,4}$' then
    v_total_count := least((p_payload ->> 'totalCount')::integer, 1000);
  end if;
  if coalesce(p_payload ->> 'successCount', '') ~ '^\d{1,4}$' then
    v_success_count := least((p_payload ->> 'successCount')::integer, v_total_count);
  end if;

  if jsonb_typeof(p_payload -> 'castNames') = 'array' then
    select coalesce(array_agg(left(item.value, 200) order by item.ordinality), array[]::text[])
    into v_cast_names
    from jsonb_array_elements_text(p_payload -> 'castNames') with ordinality as item(value, ordinality)
    where item.ordinality <= 100;
  end if;

  if jsonb_typeof(p_payload -> 'results') = 'array' then
    v_results := p_payload -> 'results';
  end if;
  if jsonb_typeof(p_payload -> 'configuration') = 'object' then
    v_configuration := p_payload -> 'configuration';
  end if;

  update public.automation_connections as connection
  set configuration = jsonb_set(
        case
          when jsonb_typeof(connection.configuration) = 'object'
            then connection.configuration
          else '{}'::jsonb
        end,
        '{availability_refresh}',
        case
          when jsonb_typeof(connection.configuration -> 'availability_refresh') = 'object'
            then connection.configuration -> 'availability_refresh'
          else '{}'::jsonb
        end || v_configuration,
        true
      ),
      status = case
        when p_payload ->> 'connectionStatus' = 'login_in_progress'
          then 'login_in_progress'
        else connection.status
      end,
      last_error = case
        when p_payload ->> 'connectionStatus' = 'login_in_progress'
          then left(coalesce(p_payload ->> 'connectionError', ''), 1000)
        else connection.last_error
      end,
      updated_at = now()
  where connection.store_id = p_store_id
    and connection.provider = 'estama';

  update public.estama_sync_reports as report
  set status = v_status,
      finished_at = now(),
      total_count = v_total_count,
      success_count = v_success_count,
      cast_names = v_cast_names,
      summary = left(
        coalesce(p_payload ->> 'summary', 'エスたま ご案内状況の更新結果を保存しました。'),
        5000
      ),
      results = v_results,
      evidence = '[]'::jsonb,
      missing_profiles = array[]::text[],
      fatal_error = nullif(left(coalesce(p_payload ->> 'fatalError', ''), 1000), '')
  where report.id = v_report_id;

  if not found then
    return false;
  end if;

  update private.estama_availability_run_stores
  set completed_at = now()
  where run_id = v_run_id
    and store_id = p_store_id;

  return true;
end;
$$;

revoke all on function public.save_estama_availability_result(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_estama_availability_result(text, uuid, jsonb)
  to anon, authenticated, service_role;

-- 毎分プロフィール同期と日次シフト同期は、ご案内状況が同じBrowserbase
-- contextを操作している間だけ開始を待つ。ジョブはqueuedのまま次回に再試行される。
create or replace function private.dispatch_estama_profile_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_request_id bigint;
  v_lease_owner text;
  v_target_count integer := 0;
  v_owned_count integer := 0;
begin
  delete from private.estama_context_leases
  where expires_at <= now();

  if exists (
    select 1
    from private.estama_context_leases as lease
    where lease.operation = 'hourly-availability-refresh'
      and lease.expires_at > now()
  ) then
    return null;
  end if;

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

  v_lease_owner := encode(extensions.gen_random_bytes(16), 'hex');
  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  )
  select distinct
    job.store_id,
    v_lease_owner,
    'profile-dispatch-reservation',
    now(),
    now() + interval '15 minutes'
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

  select count(distinct job.store_id)
  into v_target_count
  from public.automation_jobs as job
  where job.provider = 'estama'
    and job.job_type = 'estama_register_cast'
    and job.status = 'queued'
    and job.available_at <= now();

  select count(*)
  into v_owned_count
  from private.estama_context_leases as lease
  where lease.owner_token = v_lease_owner
    and lease.expires_at > now();

  if v_owned_count <> v_target_count then
    delete from private.estama_context_leases
    where owner_token = v_lease_owner;
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

create or replace function private.dispatch_estama_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_request_id bigint;
  v_lease_owner text;
  v_target_count integer := 0;
  v_owned_count integer := 0;
begin
  delete from private.estama_context_leases
  where expires_at <= now();

  if exists (
    select 1
    from private.estama_context_leases as lease
    where lease.operation = 'hourly-availability-refresh'
      and lease.expires_at > now()
  ) then
    return null;
  end if;

  v_lease_owner := encode(extensions.gen_random_bytes(16), 'hex');
  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  )
  select
    connection.store_id,
    v_lease_owner,
    'shift-dispatch-reservation',
    now(),
    now() + interval '15 minutes'
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null
  on conflict (store_id) do update
  set owner_token = excluded.owner_token,
      operation = excluded.operation,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where lease.expires_at <= now();

  select count(*)
  into v_target_count
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null;

  select count(*)
  into v_owned_count
  from private.estama_context_leases as lease
  where lease.owner_token = v_lease_owner
    and lease.expires_at > now();

  if v_owned_count <> v_target_count then
    delete from private.estama_context_leases
    where owner_token = v_lease_owner;
    return null;
  end if;

  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    encode(extensions.digest(v_raw_token, 'sha256'), 'hex'),
    'dispatcher',
    now() + interval '10 minutes'
  );

  select net.http_post(
    url := 'https://imrxzkivwrkqbhqfbbes.supabase.co/functions/v1/estama-reconcile-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', v_raw_token),
    timeout_milliseconds := 300000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_estama_sync()
  from public, anon, authenticated;
grant execute on function private.dispatch_estama_sync()
  to service_role;

create or replace function private.dispatch_estama_availability_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_token_hash text;
  v_request_id bigint;
begin
  update public.estama_sync_reports as report
  set status = 'error',
      finished_at = now(),
      summary = '⚠️ エスたま ご案内状況の更新が途中で中断されました。' || E'\n'
        || '次回の毎時実行で自動再試行します。',
      fatal_error = '毎時更新の呼び出しが完了しませんでした'
  where report.status = 'warning'
    and report.summary = '⏳ エスたま ご案内状況の毎時更新を開始しました。'
    and report.created_at < now() - interval '15 minutes'
    and report.results @> jsonb_build_object('kind', 'availability_refresh');

  if not exists (
    select 1
    from public.automation_connections as connection
    where connection.provider = 'estama'
      and connection.status = 'ready'
      and connection.browserbase_context_id is not null
  ) then
    return null;
  end if;

  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    v_token_hash,
    'availability-refresh',
    now() + interval '10 minutes'
  );

  insert into public.estama_sync_reports (
    store_id,
    shop_id,
    status,
    started_at,
    finished_at,
    total_count,
    success_count,
    cast_names,
    summary,
    results,
    evidence,
    missing_profiles,
    fatal_error
  )
  select
    connection.store_id,
    connection.shop_id,
    'warning',
    now(),
    now(),
    0,
    0,
    array[]::text[],
    '⏳ エスたま ご案内状況の毎時更新を開始しました。',
    jsonb_build_object(
      'kind', 'availability_refresh',
      'dispatch_token_hash', v_token_hash
    ),
    '[]'::jsonb,
    array[]::text[],
    null
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null;

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/cron/estama-availability',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', v_raw_token),
    timeout_milliseconds := 300000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_estama_availability_refresh()
  from public, anon, authenticated;
grant execute on function private.dispatch_estama_availability_refresh()
  to service_role;

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'estama-availability-hourly'
  ) then
    perform cron.unschedule('estama-availability-hourly');
  end if;

  perform cron.schedule(
    'estama-availability-hourly',
    '40 * * * *',
    $job$select private.dispatch_estama_availability_refresh();$job$
  );
end;
$$;
