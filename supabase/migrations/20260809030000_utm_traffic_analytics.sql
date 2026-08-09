-- Record UTM/referrer attribution for public-site sessions and keep analytics store-scoped.

-- Analytics were made multi-tenant after their original primary keys were created.
-- Include store_id in every aggregate key so 全力エステ and 艶華 never share counters.
alter table public.hp_analytics_daily drop constraint if exists hp_analytics_daily_pkey;
alter table public.hp_analytics_daily
  add constraint hp_analytics_daily_pkey primary key (store_id, date);

alter table public.hp_analytics_pages drop constraint if exists hp_analytics_pages_pkey;
alter table public.hp_analytics_pages
  add constraint hp_analytics_pages_pkey primary key (store_id, date, page_path);

alter table public.hp_analytics_hourly drop constraint if exists hp_analytics_hourly_pkey;
alter table public.hp_analytics_hourly
  add constraint hp_analytics_hourly_pkey primary key (store_id, date, hour);

alter table public.hp_analytics_traffic
  add column if not exists medium text not null default '',
  add column if not exists campaign text not null default '',
  add column if not exists content text not null default '',
  add column if not exists landing_path text not null default '';

alter table public.hp_analytics_traffic drop constraint if exists hp_analytics_traffic_pkey;
alter table public.hp_analytics_traffic
  add constraint hp_analytics_traffic_pkey
  primary key (store_id, date, source, medium, campaign, content, landing_path);

create index if not exists idx_hp_analytics_traffic_store_date
  on public.hp_analytics_traffic (store_id, date desc);

-- These aggregate tables are written only through the bounded public RPC below.
-- Remove direct anonymous/authenticated mutation paths left by the original migration.
drop policy if exists "hp_analytics_daily insert" on public.hp_analytics_daily;
drop policy if exists "hp_analytics_daily update" on public.hp_analytics_daily;
drop policy if exists "hp_analytics_pages insert" on public.hp_analytics_pages;
drop policy if exists "hp_analytics_pages update" on public.hp_analytics_pages;
drop policy if exists "hp_analytics_hourly insert" on public.hp_analytics_hourly;
drop policy if exists "hp_analytics_hourly update" on public.hp_analytics_hourly;
drop policy if exists "hp_analytics_traffic insert" on public.hp_analytics_traffic;
drop policy if exists "hp_analytics_traffic update" on public.hp_analytics_traffic;

drop trigger if exists trg_set_store_id on public.hp_analytics_daily;
drop trigger if exists trg_set_store_id on public.hp_analytics_pages;
drop trigger if exists trg_set_store_id on public.hp_analytics_hourly;
drop trigger if exists trg_set_store_id on public.hp_analytics_traffic;

revoke all on table public.hp_analytics_daily from anon;
revoke all on table public.hp_analytics_pages from anon;
revoke all on table public.hp_analytics_hourly from anon;
revoke all on table public.hp_analytics_traffic from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.hp_analytics_daily, public.hp_analytics_pages,
    public.hp_analytics_hourly, public.hp_analytics_traffic
  from authenticated;

grant select on table public.hp_analytics_daily, public.hp_analytics_pages,
  public.hp_analytics_hourly, public.hp_analytics_traffic
  to authenticated;
grant all on table public.hp_analytics_daily, public.hp_analytics_pages,
  public.hp_analytics_hourly, public.hp_analytics_traffic
  to service_role;

drop function if exists public.record_page_view(text);
drop function if exists public.record_page_view(text, boolean, boolean);

create function public.record_page_view(
  p_path text,
  p_store_id uuid,
  p_is_new_session boolean default false,
  p_is_new_daily_visitor boolean default false,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_referrer_host text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_hour integer := extract(hour from now() at time zone 'Asia/Tokyo');
  v_path text;
  v_source text;
  v_medium text;
  v_campaign text;
  v_content text;
begin
  -- This RPC is intentionally public. Keep its write surface to short aggregate dimensions.
  if p_path is null or left(p_path, 1) <> '/' or length(p_path) > 500 then
    return;
  end if;
  if not exists (select 1 from public.stores where id = p_store_id and is_active = true) then
    return;
  end if;

  v_path := left(p_path, 500);
  v_source := lower(left(coalesce(
    nullif(btrim(p_utm_source), ''),
    nullif(btrim(p_referrer_host), ''),
    'direct'
  ), 120));
  v_medium := lower(left(coalesce(nullif(btrim(p_utm_medium), ''), ''), 120));
  v_campaign := left(coalesce(nullif(btrim(p_utm_campaign), ''), ''), 160);
  v_content := left(coalesce(nullif(btrim(p_utm_content), ''), ''), 160);

  insert into public.hp_analytics_daily
    (store_id, date, visits, unique_visitors, page_views)
  values (
    p_store_id,
    v_today,
    case when p_is_new_session then 1 else 0 end,
    case when p_is_new_daily_visitor then 1 else 0 end,
    1
  )
  on conflict (store_id, date) do update set
    page_views = hp_analytics_daily.page_views + 1,
    visits = hp_analytics_daily.visits + case when p_is_new_session then 1 else 0 end,
    unique_visitors = hp_analytics_daily.unique_visitors
      + case when p_is_new_daily_visitor then 1 else 0 end,
    updated_at = now();

  insert into public.hp_analytics_pages (store_id, date, page_path, views)
  values (p_store_id, v_today, v_path, 1)
  on conflict (store_id, date, page_path) do update set
    views = hp_analytics_pages.views + 1;

  insert into public.hp_analytics_hourly (store_id, date, hour, visits)
  values (p_store_id, v_today, v_hour, 1)
  on conflict (store_id, date, hour) do update set
    visits = hp_analytics_hourly.visits + 1;

  if p_is_new_session then
    insert into public.hp_analytics_traffic
      (store_id, date, source, medium, campaign, content, landing_path, visits)
    values (
      p_store_id, v_today, v_source, v_medium, v_campaign, v_content, v_path, 1
    )
    on conflict (store_id, date, source, medium, campaign, content, landing_path)
    do update set visits = hp_analytics_traffic.visits + 1;
  end if;
end;
$$;

revoke all on function public.record_page_view(
  text, uuid, boolean, boolean, text, text, text, text, text
) from public;
grant execute on function public.record_page_view(
  text, uuid, boolean, boolean, text, text, text, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
