-- 未着手の宣伝計画だけ、準備物を共通の3項目へ統一する。
with untouched_plans as (
  select p.id
  from public.promotion_plans p
  where p.is_active = true
    and exists (
      select 1
      from public.promotion_plan_tasks t
      where t.plan_id = p.id
        and t.task_type = 'preparation'
    )
    and not exists (
      select 1
      from public.promotion_plan_tasks t
      where t.plan_id = p.id
        and t.task_type = 'preparation'
        and t.is_completed = true
    )
), deleted_preparation as (
  delete from public.promotion_plan_tasks t
  using untouched_plans p
  where t.plan_id = p.id
    and t.task_type = 'preparation'
  returning t.plan_id, t.store_id
), target_plans as (
  select distinct plan_id, store_id
  from deleted_preparation
), standard_preparation(task_key, label, sort_order) as (
  values
    ('prep-001', 'ショート動画 3本（各5秒／ティザー・中盤・最終で使い分け）', 10),
    ('prep-002', '2ショット宣材写真 3パターン', 20),
    ('prep-003', '告知バナー 1点（横長／X・エステ魂ヘッダー想定）', 30)
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
  sort_order
)
select
  p.store_id,
  p.plan_id,
  standard.task_key,
  'preparation',
  null,
  '準備物',
  standard.label,
  false,
  standard.sort_order
from target_plans p
cross join standard_preparation standard;
