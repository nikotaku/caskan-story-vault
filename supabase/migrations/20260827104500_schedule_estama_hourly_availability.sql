-- Vercel Hobbyでは毎時Cronを使えないため、既存のSupabase pg_cronから
-- 一回限りトークン付きでVercelのBrowserbase処理を呼び出す。

alter table public.estama_sync_tokens
  drop constraint if exists estama_sync_tokens_purpose_check;

alter table public.estama_sync_tokens
  add constraint estama_sync_tokens_purpose_check
  check (
    purpose in ('dispatcher', 'worker', 'profile-worker', 'availability-refresh')
    or purpose like 'report:%'
    or purpose like 'notify:%'
    or purpose like 'continue:%'
  );

create table if not exists private.estama_context_leases (
  store_id uuid primary key references public.stores(id) on delete cascade,
  owner_token text not null,
  operation text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

revoke all on table private.estama_context_leases
  from public, anon, authenticated;

create or replace function public.claim_estama_context_lease(
  p_store_id uuid,
  p_owner_token text,
  p_operation text,
  p_ttl_seconds integer default 480
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_store_id is null
     or length(coalesce(p_owner_token, '')) < 16
     or length(coalesce(p_operation, '')) < 3 then
    return false;
  end if;

  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  ) values (
    p_store_id,
    p_owner_token,
    left(p_operation, 100),
    now(),
    now() + make_interval(secs => greatest(60, least(p_ttl_seconds, 900)))
  )
  on conflict (store_id) do update
  set owner_token = excluded.owner_token,
      operation = excluded.operation,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where lease.expires_at <= now()
     or lease.owner_token = excluded.owner_token;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create or replace function public.release_estama_context_lease(
  p_store_id uuid,
  p_owner_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.estama_context_leases
  where store_id = p_store_id
    and owner_token = p_owner_token;
  return found;
end;
$$;

revoke all on function public.claim_estama_context_lease(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_estama_context_lease(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_estama_context_lease(uuid, text, text, integer)
  to service_role;
grant execute on function public.release_estama_context_lease(uuid, text)
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
  from public.automation_connections connection
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
