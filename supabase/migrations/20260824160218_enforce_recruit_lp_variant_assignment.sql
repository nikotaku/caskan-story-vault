-- Keep each visitor hash assigned to the first recruitment LP variant it exposed.

create unique index if not exists recruit_lp_one_variant_per_visitor
  on public.recruit_lp_event_dedup (
    store_id, experiment_id, event_type, visitor_hash
  );

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
  v_assigned_variant text;
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

  select d.variant
    into v_assigned_variant
  from public.recruit_lp_event_dedup d
  where d.store_id = p_store_id
    and d.experiment_id = p_experiment_id
    and d.event_type = 'exposure'
    and d.visitor_hash = p_visitor_hash;

  if v_assigned_variant is distinct from p_variant then
    return false;
  end if;

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

revoke all on function public.record_recruit_lp_event(uuid, text, text, text, text, text) from public;
grant execute on function public.record_recruit_lp_event(uuid, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
