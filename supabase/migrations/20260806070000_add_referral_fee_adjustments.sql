create table if not exists public.referral_fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid
    references public.stores(id),
  month_date date not null,
  referral_reward_id uuid not null
    references public.referral_rewards(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) > 0),
  amount integer not null check (amount > 0),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_fee_adjustments_store_month
  on public.referral_fee_adjustments(store_id, month_date);

create index if not exists idx_referral_fee_adjustments_reward
  on public.referral_fee_adjustments(referral_reward_id);

alter table public.referral_fee_adjustments enable row level security;

create policy "store_members_manage_referral_fee_adjustments"
  on public.referral_fee_adjustments
  for all
  to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

drop trigger if exists trg_set_store_id on public.referral_fee_adjustments;
create trigger trg_set_store_id
  before insert on public.referral_fee_adjustments
  for each row execute function public.set_store_id();

grant select, insert, update, delete
  on table public.referral_fee_adjustments
  to authenticated;
