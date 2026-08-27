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

create or replace function private.dispatch_estama_availability_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_request_id bigint;
begin
  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    encode(extensions.digest(v_raw_token, 'sha256'), 'hex'),
    'availability-refresh',
    now() + interval '10 minutes'
  );

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
    '0 * * * *',
    $job$select private.dispatch_estama_availability_refresh();$job$
  );
end;
$$;
