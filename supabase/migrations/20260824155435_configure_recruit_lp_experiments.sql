-- Version recruitment experiments as data so future copy changes cannot silently mix metrics.

create table if not exists public.recruit_lp_experiments (
  store_id uuid not null references public.stores(id) on delete cascade,
  experiment_id text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now(),
  primary key (store_id, experiment_id),
  check (experiment_id ~ '^[a-z0-9_-]{1,80}$'),
  check (ended_on is null or ended_on >= started_on)
);

create unique index if not exists recruit_lp_one_active_experiment_per_store
  on public.recruit_lp_experiments (store_id)
  where status = 'active';

alter table public.recruit_lp_experiments enable row level security;

create policy "store members read recruit experiments"
  on public.recruit_lp_experiments
  for select to authenticated
  using (store_id in (select public.current_store_ids()));
create policy "service role manages recruit experiments"
  on public.recruit_lp_experiments
  for all to service_role
  using (true) with check (true);

revoke all on table public.recruit_lp_experiments from anon, authenticated;
grant select on table public.recruit_lp_experiments to authenticated;
grant all on table public.recruit_lp_experiments to service_role;

insert into public.recruit_lp_experiments (
  store_id, experiment_id, name, status, started_on
) values (
  '404499ab-5350-490f-9608-5814faffda6f',
  'recruit_hero_v1_20260825',
  '安心訴求 vs 自由な働き方訴求',
  'active',
  '2026-08-25'
)
on conflict (store_id, experiment_id) do update set
  name = excluded.name,
  status = excluded.status,
  started_on = excluded.started_on,
  ended_on = null;

alter table public.recruit_lp_event_rate_limits
  drop constraint if exists recruit_lp_event_rate_limits_request_count_check;
alter table public.recruit_lp_event_rate_limits
  add constraint recruit_lp_event_rate_limits_request_count_check
  check (request_count between 0 and 500);

create or replace function public.record_recruit_lp_event(
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
    or not exists (
      select 1 from public.recruit_lp_experiments e
      where e.store_id = p_store_id
        and e.experiment_id = p_experiment_id
        and e.status = 'active'
        and e.started_on <= v_today
        and (e.ended_on is null or e.ended_on >= v_today)
    )
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
  where public.recruit_lp_event_rate_limits.request_count < 500
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
      p_store_id, v_today, p_experiment_id, p_variant,
      v_exposure_increment, v_click_increment
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

-- Replace the public static back-rate image with token-gated dynamic rows.
create or replace function public.get_therapist_back_rates(p_token text)
returns table (
  course_type text,
  duration integer,
  therapist_back integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.course_type, b.duration, b.therapist_back
  from public.casts c
  join public.back_rates b on b.store_id = c.store_id
  where c.access_token = p_token
    and c.is_active = true
  order by b.display_order, b.duration;
$$;

revoke all on function public.get_therapist_back_rates(text) from public;
grant execute on function public.get_therapist_back_rates(text) to anon, authenticated;

comment on table public.recruit_lp_experiments is
  'Versioned recruitment LP experiments; one active experiment per store.';
comment on function public.get_therapist_back_rates(text) is
  'Returns therapist compensation rows only for a valid active therapist portal token.';

notify pgrst, 'reload schema';
