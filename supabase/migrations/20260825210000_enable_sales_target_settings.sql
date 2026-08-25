-- Make monthly and daily sales targets writable per store.
-- Existing monthly target rows are preserved; the primary key is widened so
-- different stores can set targets for the same month.

do $sales_target$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.monthly_sales_targets'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (store_id, month_date)'
  ) then
    alter table public.monthly_sales_targets
      drop constraint if exists monthly_sales_targets_pkey;
    alter table public.monthly_sales_targets
      add constraint monthly_sales_targets_pkey primary key (store_id, month_date);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.monthly_sales_targets'::regclass
      and conname = 'monthly_sales_targets_target_revenue_nonnegative'
  ) then
    alter table public.monthly_sales_targets
      add constraint monthly_sales_targets_target_revenue_nonnegative
      check (target_revenue >= 0);
  end if;
end
$sales_target$;

create table if not exists public.daily_sales_targets (
  store_id uuid not null references public.stores(id),
  target_date date not null,
  target_amount bigint not null default 0
    constraint daily_sales_targets_target_amount_nonnegative check (target_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_sales_targets_pkey primary key (store_id, target_date)
);

alter table public.daily_sales_targets enable row level security;

grant select, insert, update, delete on table public.daily_sales_targets to authenticated;
grant select, insert, update, delete on table public.daily_sales_targets to service_role;
revoke all on table public.daily_sales_targets from anon;

drop policy if exists "daily_sales_targets store access" on public.daily_sales_targets;
create policy "daily_sales_targets store access"
on public.daily_sales_targets
for all
to authenticated
using (store_id in (select public.current_store_ids()))
with check (store_id in (select public.current_store_ids()));
