-- 宣伝先ごとの掲載量・画像仕様を計画単位で保存する。
alter table public.promotion_plan_tasks
  add column if not exists channel_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotion_plan_tasks_channel_key_check'
      and conrelid = 'public.promotion_plan_tasks'::regclass
  ) then
    alter table public.promotion_plan_tasks
      add constraint promotion_plan_tasks_channel_key_check check (
        channel_key is null or channel_key in (
          'hp_top_banner',
          'estama_top_banner',
          'x_post',
          'o2_post',
          'o2_story',
          'line_official'
        )
      );
  end if;
end;
$$;

create table if not exists public.promotion_plan_channels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid not null references public.promotion_plans(id) on delete cascade,
  channel_key text not null,
  channel_label text not null,
  is_enabled boolean not null default true,
  placement_count integer not null default 1,
  size_spec text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_plan_channels_plan_key_unique unique (plan_id, channel_key),
  constraint promotion_plan_channels_key_check check (
    channel_key in (
      'hp_top_banner',
      'estama_top_banner',
      'x_post',
      'o2_post',
      'o2_story',
      'line_official'
    )
  ),
  constraint promotion_plan_channels_count_check check (placement_count between 0 and 30),
  constraint promotion_plan_channels_enabled_count_check check (
    (is_enabled = true and placement_count >= 1)
    or (is_enabled = false and placement_count >= 0)
  )
);

create index if not exists promotion_plan_channels_store_idx
  on public.promotion_plan_channels (store_id);

create index if not exists promotion_plan_channels_plan_sort_idx
  on public.promotion_plan_channels (plan_id, sort_order);

alter table public.promotion_plan_channels enable row level security;
alter table public.promotion_plan_channels force row level security;

drop policy if exists promotion_plan_channels_store_managers on public.promotion_plan_channels;
create policy promotion_plan_channels_store_managers
on public.promotion_plan_channels
for all
to authenticated
using ((select public.can_manage_store(store_id)))
with check ((select public.can_manage_store(store_id)));

revoke all on table public.promotion_plan_channels from anon;
grant select, insert, update, delete on table public.promotion_plan_channels to authenticated;

-- 既存タスクは作業名から宣伝先を判定する。
update public.promotion_plan_tasks
set channel_key = case
  when label ~* '(02|O2)' and label like '%ストーリー%' then 'o2_story'
  when label ~* '(02|O2)' then 'o2_post'
  when label ilike '%エスたま%' or label ilike '%エステ魂%' then 'estama_top_banner'
  when label ilike '%HP%' then 'hp_top_banner'
  when label ~* '(^|[^[:alnum:]])X([^[:alnum:]]|$)' then 'x_post'
  when label ilike '%LINE%' then 'line_official'
  else null
end
where task_type = 'posting'
  and channel_key is null;

-- 既存計画にも6媒体の管理行を用意し、既存タスク数を掲載量として引き継ぐ。
with channel_definitions(channel_key, channel_label, sort_order) as (
  values
    ('hp_top_banner', 'HPトップバナー', 10),
    ('estama_top_banner', 'エステ魂トップバナー', 20),
    ('x_post', 'X投稿', 30),
    ('o2_post', '02投稿', 40),
    ('o2_story', '02ストーリー', 50),
    ('line_official', 'LINE公式アカウントでの宣伝', 60)
), existing_counts as (
  select plan_id, channel_key, count(*)::integer as placement_count
  from public.promotion_plan_tasks
  where channel_key is not null
  group by plan_id, channel_key
)
insert into public.promotion_plan_channels (
  store_id,
  plan_id,
  channel_key,
  channel_label,
  is_enabled,
  placement_count,
  size_spec,
  sort_order
)
select
  p.store_id,
  p.id,
  d.channel_key,
  d.channel_label,
  coalesce(c.placement_count, 0) > 0,
  coalesce(c.placement_count, 0),
  null,
  d.sort_order
from public.promotion_plans p
cross join channel_definitions d
left join existing_counts c
  on c.plan_id = p.id
 and c.channel_key = d.channel_key
on conflict (plan_id, channel_key) do nothing;

create or replace function public.get_therapist_promotion_channels(p_token text)
returns table (
  plan_id uuid,
  channel_key text,
  channel_label text,
  placement_count integer,
  size_spec text,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cast_id uuid;
  v_cast_name text;
begin
  select c.id, c.name
    into v_cast_id, v_cast_name
  from public.casts c
  where c.access_token = p_token
  limit 1;

  if v_cast_id is null then
    raise exception 'invalid token';
  end if;

  return query
  select
    pc.plan_id,
    pc.channel_key,
    pc.channel_label,
    pc.placement_count,
    pc.size_spec,
    pc.sort_order
  from public.promotion_plan_channels pc
  join public.promotion_plans p on p.id = pc.plan_id
  where p.is_active = true
    and pc.is_enabled = true
    and (
      v_cast_id = any(p.cast_ids)
      or (
        cardinality(p.cast_ids) = 0
        and (
          p.therapist_label = v_cast_name
          or v_cast_name = any(regexp_split_to_array(p.therapist_label, '\s*[&＆]\s*'))
        )
      )
    )
  order by p.starts_on desc nulls last, p.created_at desc, pc.sort_order;
end;
$$;

comment on function public.get_therapist_promotion_channels(text) is
  'ポータルトークンの本人に紐付く宣伝先・掲載量・サイズ仕様だけを返す。';

revoke all on function public.get_therapist_promotion_channels(text) from public, anon, authenticated;
grant execute on function public.get_therapist_promotion_channels(text) to anon, authenticated;
