-- シフト同期をセラピスト単位の短いBrowserbase実行へ分割する。
-- 各実行の完了後に次をpg_netへ渡すため、Vercelの実行時間上限を超えない。

alter table public.estama_sync_tokens
  drop constraint if exists estama_sync_tokens_purpose_check;

alter table public.estama_sync_tokens
  add constraint estama_sync_tokens_purpose_check
  check (
    purpose in ('dispatcher', 'worker', 'profile-worker')
    or purpose like 'report:%'
    or purpose like 'notify:%'
    or purpose like 'continue:%'
  );

create or replace function public.dispatch_estama_worker_request(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id bigint;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or length(coalesce(p_payload ->> 'token', '')) < 48 then
    raise exception 'invalid estama worker payload';
  end if;

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/automations/estama-worker',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := p_payload,
    timeout_milliseconds := 300000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_estama_worker_request(jsonb)
  from public, anon, authenticated;
grant execute on function public.dispatch_estama_worker_request(jsonb)
  to service_role;

create or replace function public.dispatch_estama_worker_continuation(
  p_token text,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
  request_id bigint;
begin
  if p_token is null
     or length(p_token) < 48
     or jsonb_typeof(p_payload) <> 'object'
     or length(coalesce(p_payload ->> 'token', '')) < 48 then
    return null;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and purpose like 'continue:%'
    and used_at is null
    and expires_at > now()
  returning id into claimed_id;

  if claimed_id is null then
    return null;
  end if;

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/automations/estama-worker',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := p_payload,
    timeout_milliseconds := 300000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_estama_worker_continuation(text, jsonb)
  from public;
grant execute on function public.dispatch_estama_worker_continuation(text, jsonb)
  to anon, authenticated, service_role;
