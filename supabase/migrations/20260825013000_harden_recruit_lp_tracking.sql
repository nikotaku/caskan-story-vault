-- Harden recruitment LP measurement behind a same-origin server endpoint.
-- Only keyed hashes are stored; raw IP addresses, user agents and browser tokens are never persisted.

create table if not exists public.recruit_lp_event_dedup (
  store_id uuid not null references public.stores(id) on delete cascade,
  experiment_id text not null,
  variant text not null,
  event_type text not null,
  visitor_hash text not null,
  first_seen_date date not null,
  created_at timestamptz not null default now(),
  primary key (store_id, experiment_id, variant, event_type, visitor_hash),
  check (experiment_id ~ '^[a-z0-9_-]{1,80}$'),
  check (variant in ('safety_first', 'freedom_first')),
  check (event_type in ('exposure', 'cta_click')),
  check (visitor_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public.recruit_lp_event_rate_limits (
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  experiment_id text not null,
  rate_hash text not null,
  request_count integer not null default 1 check (request_count between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (store_id, date, experiment_id, rate_hash),
  check (experiment_id ~ '^[a-z0-9_-]{1,80}$'),
  check (rate_hash ~ '^[a-f0-9]{64}$')
);

alter table public.recruit_lp_event_dedup enable row level security;
alter table public.recruit_lp_event_rate_limits enable row level security;

create policy "service role manages recruit event dedup"
  on public.recruit_lp_event_dedup
  for all to service_role
  using (true) with check (true);
create policy "service role manages recruit event rate limits"
  on public.recruit_lp_event_rate_limits
  for all to service_role
  using (true) with check (true);

revoke all on table public.recruit_lp_event_dedup from anon, authenticated;
revoke all on table public.recruit_lp_event_rate_limits from anon, authenticated;
grant all on table public.recruit_lp_event_dedup to service_role;
grant all on table public.recruit_lp_event_rate_limits to service_role;

revoke all on function public.record_recruit_lp_event(uuid, text, text, text)
  from public, anon, authenticated, service_role;
drop function public.record_recruit_lp_event(uuid, text, text, text);

create function public.record_recruit_lp_event(
  p_store_id uuid,
  p_experiment_id text,
  p_variant text,
  p_event text,
  p_visitor_hash text,
  p_rate_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_rate_allowed boolean;
  v_exposure_increment integer := 0;
  v_click_increment integer := 0;
begin
  if p_store_id is null
    or not exists (
      select 1 from public.stores
      where id = p_store_id and is_active = true
    )
    or p_experiment_id <> 'recruit_hero_v1_20260825'
    or p_variant not in ('safety_first', 'freedom_first')
    or p_event not in ('exposure', 'cta_click')
    or p_visitor_hash !~ '^[a-f0-9]{64}$'
    or p_rate_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  insert into public.recruit_lp_event_rate_limits (
    store_id, date, experiment_id, rate_hash, request_count
  ) values (
    p_store_id, v_today, p_experiment_id, p_rate_hash, 1
  )
  on conflict (store_id, date, experiment_id, rate_hash)
  do update set
    request_count = public.recruit_lp_event_rate_limits.request_count + 1,
    updated_at = now()
  where public.recruit_lp_event_rate_limits.request_count < 100
  returning true into v_rate_allowed;

  if coalesce(v_rate_allowed, false) = false then
    return false;
  end if;

  insert into public.recruit_lp_event_dedup (
    store_id, experiment_id, variant, event_type, visitor_hash, first_seen_date
  ) values (
    p_store_id, p_experiment_id, p_variant, 'exposure', p_visitor_hash, v_today
  )
  on conflict do nothing;
  get diagnostics v_exposure_increment = row_count;

  if p_event = 'cta_click' then
    insert into public.recruit_lp_event_dedup (
      store_id, experiment_id, variant, event_type, visitor_hash, first_seen_date
    ) values (
      p_store_id, p_experiment_id, p_variant, 'cta_click', p_visitor_hash, v_today
    )
    on conflict do nothing;
    get diagnostics v_click_increment = row_count;
  end if;

  if v_exposure_increment + v_click_increment > 0 then
    insert into public.recruit_lp_daily_metrics (
      store_id, date, experiment_id, variant, exposures, cta_clicks
    ) values (
      p_store_id,
      v_today,
      p_experiment_id,
      p_variant,
      v_exposure_increment,
      v_click_increment
    )
    on conflict (store_id, date, experiment_id, variant)
    do update set
      exposures = public.recruit_lp_daily_metrics.exposures + excluded.exposures,
      cta_clicks = public.recruit_lp_daily_metrics.cta_clicks + excluded.cta_clicks,
      updated_at = now();
  end if;

  return true;
end;
$$;

revoke all on function public.record_recruit_lp_event(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_recruit_lp_event(uuid, text, text, text, text, text)
  to service_role;

comment on table public.recruit_lp_event_dedup is
  'Keyed anonymous hashes used to count one exposure and CTA click per browser and experiment.';
comment on table public.recruit_lp_event_rate_limits is
  'Daily keyed network hash counters used to bound public recruitment analytics traffic.';
comment on function public.record_recruit_lp_event(uuid, text, text, text, text, text) is
  'Service-only bounded recruitment LP aggregation with server-side deduplication.';

notify pgrst, 'reload schema';
