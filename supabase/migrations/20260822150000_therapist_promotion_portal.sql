-- 宣伝計画を対象セラピスト本人のポータルへ安全に公開する。
alter table public.promotion_plans
  add column if not exists cast_ids uuid[] not null default '{}'::uuid[];

create index if not exists promotion_plans_cast_ids_idx
  on public.promotion_plans using gin (cast_ids);

-- この列の追加前に作られた計画は、表示名が一致するセラピストへ紐付ける。
-- 旧店舗と現店舗に同名レコードがある場合は両方を対象にし、店舗IDでは分けない。
update public.promotion_plans p
set cast_ids = coalesce((
  select array_agg(matched_cast.id order by matched_cast.id)
  from (
    select distinct c.id
    from public.casts c
    where c.name = p.therapist_label
       or c.name = any(regexp_split_to_array(p.therapist_label, '\s*[&＆]\s*'))
  ) matched_cast
), '{}'::uuid[])
where cardinality(p.cast_ids) = 0;

create or replace function public.get_therapist_promotion_schedules(p_token text)
returns table (
  plan_id uuid,
  therapist_label text,
  plan_title text,
  plan_description text,
  starts_on date,
  ends_on date,
  task_id uuid,
  task_type text,
  scheduled_on date,
  group_label text,
  task_label text,
  is_completed boolean,
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
    p.id,
    p.therapist_label,
    p.title,
    p.description,
    p.starts_on,
    p.ends_on,
    t.id,
    t.task_type,
    t.scheduled_on,
    t.group_label,
    t.label,
    t.is_completed,
    t.sort_order
  from public.promotion_plans p
  left join public.promotion_plan_tasks t on t.plan_id = p.id
  where p.is_active = true
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
  order by p.starts_on desc nulls last, p.created_at desc, t.sort_order, t.created_at;
end;
$$;

comment on function public.get_therapist_promotion_schedules(text) is
  'ポータルのアクセストークンに一致するセラピスト本人の有効な宣伝計画だけを返す。';

revoke all on function public.get_therapist_promotion_schedules(text) from public, anon, authenticated;
grant execute on function public.get_therapist_promotion_schedules(text) to anon, authenticated;
