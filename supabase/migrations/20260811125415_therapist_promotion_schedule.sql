-- セラピスト別の事前告知計画と、媒体ごとの完了チェックを管理する。
create table if not exists public.promotion_plans (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_key text not null,
  therapist_label text not null,
  title text not null,
  description text,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_plans_store_key_unique unique (store_id, plan_key),
  constraint promotion_plans_date_order check (
    starts_on is null or ends_on is null or starts_on <= ends_on
  )
);

create table if not exists public.promotion_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid not null references public.promotion_plans(id) on delete cascade,
  task_key text not null,
  task_type text not null,
  scheduled_on date,
  group_label text not null,
  label text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_plan_tasks_plan_key_unique unique (plan_id, task_key),
  constraint promotion_plan_tasks_type_check check (task_type in ('preparation', 'posting')),
  constraint promotion_plan_tasks_date_check check (
    (task_type = 'preparation' and scheduled_on is null)
    or (task_type = 'posting' and scheduled_on is not null)
  )
);

create index if not exists promotion_plans_store_active_idx
  on public.promotion_plans (store_id, is_active, starts_on desc);

create index if not exists promotion_plan_tasks_store_idx
  on public.promotion_plan_tasks (store_id);

create index if not exists promotion_plan_tasks_plan_sort_idx
  on public.promotion_plan_tasks (plan_id, sort_order);

create index if not exists promotion_plan_tasks_completed_by_idx
  on public.promotion_plan_tasks (completed_by)
  where completed_by is not null;

alter table public.promotion_plans enable row level security;
alter table public.promotion_plans force row level security;
alter table public.promotion_plan_tasks enable row level security;
alter table public.promotion_plan_tasks force row level security;

drop policy if exists promotion_plans_store_managers on public.promotion_plans;
create policy promotion_plans_store_managers
on public.promotion_plans
for all
to authenticated
using ((select public.can_manage_store(store_id)))
with check ((select public.can_manage_store(store_id)));

drop policy if exists promotion_plan_tasks_store_managers on public.promotion_plan_tasks;
create policy promotion_plan_tasks_store_managers
on public.promotion_plan_tasks
for all
to authenticated
using ((select public.can_manage_store(store_id)))
with check ((select public.can_manage_store(store_id)));

revoke all on table public.promotion_plans from anon;
revoke all on table public.promotion_plan_tasks from anon;
grant select, insert, update, delete on table public.promotion_plans to authenticated;
grant select, insert, update, delete on table public.promotion_plan_tasks to authenticated;

-- 今回実施した「こよみ&れいな」の事前告知計画を、現在の完了状態ごと初期登録する。
with seeded_plan as (
  insert into public.promotion_plans (
    store_id,
    plan_key,
    therapist_label,
    title,
    description,
    starts_on,
    ends_on,
    is_active
  ) values (
    '404499ab-5350-490f-9608-5814faffda6f'::uuid,
    'w-therapist-koyomi-reina-2026-08',
    'こよみ&れいな',
    'Wセラピスト事前告知',
    '撮影素材を準備し、決めた日程と投稿先に沿って告知する計画',
    '2026-08-05'::date,
    '2026-08-12'::date,
    true
  )
  on conflict (store_id, plan_key) do update
  set therapist_label = excluded.therapist_label,
      title = excluded.title,
      description = excluded.description,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      is_active = excluded.is_active,
      updated_at = now()
  returning id
), task_data (
  task_key,
  task_type,
  scheduled_on,
  group_label,
  label,
  is_completed,
  sort_order
) as (
  values
    ('prep-short-video-1', 'preparation', null::date, '準備物', 'ショート動画❶', true, 10),
    ('prep-short-video-2', 'preparation', null::date, '準備物', 'ショート動画❷', true, 20),
    ('prep-short-video-3', 'preparation', null::date, '準備物', 'ショート動画❸', true, 30),
    ('prep-two-shot-1', 'preparation', null::date, '準備物', '2ショット写真×3❶', true, 40),
    ('prep-two-shot-2', 'preparation', null::date, '準備物', '2ショット写真×3❷', true, 50),
    ('prep-banner', 'preparation', null::date, '準備物', '告知バナー', true, 60),

    ('post-0805-therapist-o2', 'posting', '2026-08-05'::date, 'ティザー動画❶', 'こよみ&れいな 02（ストーリー）', true, 110),
    ('post-0805-therapist-x', 'posting', '2026-08-05'::date, 'ティザー動画❶', 'こよみ&れいな X', true, 120),
    ('post-0805-store-o2', 'posting', '2026-08-05'::date, 'ティザー動画❶', '店舗02（ストーリー）', true, 130),
    ('post-0805-store-x', 'posting', '2026-08-05'::date, 'ティザー動画❶', '店舗X', true, 140),
    ('post-0805-store-hp', 'posting', '2026-08-05'::date, 'ティザー動画❶', '店舗HP（バナー常駐）', true, 150),
    ('post-0805-store-estama', 'posting', '2026-08-05'::date, 'ティザー動画❶', '店舗エスたま動画リンク', true, 160),

    ('post-0806-therapist-o2', 'posting', '2026-08-06'::date, '告知バナー', 'こよみ&れいな 02', true, 210),
    ('post-0806-therapist-x', 'posting', '2026-08-06'::date, '告知バナー', 'こよみ&れいな X', true, 220),
    ('post-0806-store-o2', 'posting', '2026-08-06'::date, '告知バナー', '店舗02', true, 230),
    ('post-0806-store-x', 'posting', '2026-08-06'::date, '告知バナー', '店舗X', true, 240),
    ('post-0806-store-hp', 'posting', '2026-08-06'::date, '告知バナー', '店舗HP', true, 250),
    ('post-0806-store-estama', 'posting', '2026-08-06'::date, '告知バナー', '店舗エスたま', true, 260),

    ('post-0808-therapist-o2', 'posting', '2026-08-08'::date, 'ショート動画❷', 'こよみ&れいな 02（ストーリー）', true, 310),
    ('post-0808-therapist-x', 'posting', '2026-08-08'::date, 'ショート動画❷', 'こよみ&れいな X', true, 320),
    ('post-0808-store-o2', 'posting', '2026-08-08'::date, 'ショート動画❷', '店舗02（ストーリー）', true, 330),
    ('post-0808-store-x', 'posting', '2026-08-08'::date, 'ショート動画❷', '店舗X', true, 340),
    ('post-0808-store-hp', 'posting', '2026-08-08'::date, 'ショート動画❷', '店舗HP（バナー常駐）', true, 350),
    ('post-0808-store-estama', 'posting', '2026-08-08'::date, 'ショート動画❷', '店舗エスたま動画リンク', true, 360),

    ('post-0810-therapist-o2', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', 'こよみ&れいな 02', true, 410),
    ('post-0810-therapist-x', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', 'こよみ&れいな X', true, 420),
    ('post-0810-store-o2', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', '店舗02', true, 430),
    ('post-0810-store-x', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', '店舗X', true, 440),
    ('post-0810-store-hp', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', '店舗HP', false, 450),
    ('post-0810-store-estama', 'posting', '2026-08-10'::date, '2ショット写真3枚❷', '店舗エスたま', false, 460),

    ('post-0812-therapist-o2', 'posting', '2026-08-12'::date, 'ショート動画❸', 'こよみ&れいな 02（ストーリー）', false, 510),
    ('post-0812-therapist-x', 'posting', '2026-08-12'::date, 'ショート動画❸', 'こよみ&れいな X', false, 520),
    ('post-0812-store-o2', 'posting', '2026-08-12'::date, 'ショート動画❸', '店舗02（ストーリー）', false, 530),
    ('post-0812-store-x', 'posting', '2026-08-12'::date, 'ショート動画❸', '店舗X', false, 540),
    ('post-0812-store-hp', 'posting', '2026-08-12'::date, 'ショート動画❸', '店舗HP（バナー常駐）', false, 550),
    ('post-0812-store-estama', 'posting', '2026-08-12'::date, 'ショート動画❸', '店舗エスたま動画リンク', false, 560)
)
insert into public.promotion_plan_tasks (
  store_id,
  plan_id,
  task_key,
  task_type,
  scheduled_on,
  group_label,
  label,
  is_completed,
  completed_at,
  sort_order
)
select
  '404499ab-5350-490f-9608-5814faffda6f'::uuid,
  seeded_plan.id,
  task_data.task_key,
  task_data.task_type,
  task_data.scheduled_on,
  task_data.group_label,
  task_data.label,
  task_data.is_completed,
  case when task_data.is_completed then now() else null end,
  task_data.sort_order
from seeded_plan
cross join task_data
on conflict (plan_id, task_key) do update
set task_type = excluded.task_type,
    scheduled_on = excluded.scheduled_on,
    group_label = excluded.group_label,
    label = excluded.label,
    sort_order = excluded.sort_order,
    updated_at = now();
