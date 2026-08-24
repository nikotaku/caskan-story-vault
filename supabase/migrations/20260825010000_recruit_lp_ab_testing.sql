-- Daily aggregate metrics for the public recruitment LP A/B test.
-- No visitor identifier or applicant personal data is stored.

create table if not exists public.recruit_lp_daily_metrics (
  store_id uuid not null references public.stores(id) on delete cascade,
  date date not null,
  experiment_id text not null,
  variant text not null,
  exposures integer not null default 0 check (exposures >= 0),
  cta_clicks integer not null default 0 check (cta_clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, date, experiment_id, variant),
  constraint recruit_lp_metrics_experiment_format
    check (experiment_id ~ '^[a-z0-9_-]{1,80}$'),
  constraint recruit_lp_metrics_variant_format
    check (variant in ('safety_first', 'freedom_first'))
);

create index if not exists recruit_lp_daily_metrics_store_date_idx
  on public.recruit_lp_daily_metrics (store_id, date desc);

alter table public.recruit_lp_daily_metrics enable row level security;

drop policy if exists "store members read recruit lp metrics"
  on public.recruit_lp_daily_metrics;
create policy "store members read recruit lp metrics"
  on public.recruit_lp_daily_metrics
  for select
  to authenticated
  using (store_id in (select public.current_store_ids()));

revoke all on table public.recruit_lp_daily_metrics from anon, authenticated;
grant select on table public.recruit_lp_daily_metrics to authenticated;
grant all on table public.recruit_lp_daily_metrics to service_role;

create or replace function public.record_recruit_lp_event(
  p_store_id uuid,
  p_experiment_id text,
  p_variant text,
  p_event text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_exposure_increment integer := case when p_event = 'exposure' then 1 else 0 end;
  v_click_increment integer := case when p_event = 'cta_click' then 1 else 0 end;
begin
  if p_store_id is null
    or not exists (
      select 1 from public.stores
      where id = p_store_id and is_active = true
    ) then
    return;
  end if;

  if p_experiment_id is null
    or p_experiment_id !~ '^[a-z0-9_-]{1,80}$'
    or p_variant not in ('safety_first', 'freedom_first')
    or p_event not in ('exposure', 'cta_click') then
    return;
  end if;

  insert into public.recruit_lp_daily_metrics (
    store_id,
    date,
    experiment_id,
    variant,
    exposures,
    cta_clicks
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
end;
$$;

revoke all on function public.record_recruit_lp_event(uuid, text, text, text) from public;
grant execute on function public.record_recruit_lp_event(uuid, text, text, text)
  to anon, authenticated, service_role;

comment on table public.recruit_lp_daily_metrics is
  'Daily aggregate exposure and LINE CTA click metrics for recruitment LP experiments.';
comment on function public.record_recruit_lp_event(uuid, text, text, text) is
  'Bounded public RPC for recruitment LP exposure and CTA click aggregation.';

notify pgrst, 'reload schema';
