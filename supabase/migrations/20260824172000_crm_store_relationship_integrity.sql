-- RLS limits the row's store_id, while these composite foreign keys ensure the
-- referenced customer/cast belongs to that same store. This prevents a known
-- UUID from another store being attached to a locally-visible CRM row.

create unique index if not exists uq_customers_id_store_id
  on public.customers (id, store_id);

create unique index if not exists uq_casts_id_store_id
  on public.casts (id, store_id);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_profiles'::regclass
      and conname = 'customer_profiles_customer_store_fkey'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_customer_store_fkey
      foreign key (customer_id, store_id)
      references public.customers (id, store_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_followups'::regclass
      and conname = 'customer_followups_customer_store_fkey'
  ) then
    alter table public.customer_followups
      add constraint customer_followups_customer_store_fkey
      foreign key (customer_id, store_id)
      references public.customers (id, store_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_ng_casts'::regclass
      and conname = 'customer_ng_casts_customer_store_fkey'
  ) then
    alter table public.customer_ng_casts
      add constraint customer_ng_casts_customer_store_fkey
      foreign key (customer_id, store_id)
      references public.customers (id, store_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_ng_casts'::regclass
      and conname = 'customer_ng_casts_cast_store_fkey'
  ) then
    alter table public.customer_ng_casts
      add constraint customer_ng_casts_cast_store_fkey
      foreign key (cast_id, store_id)
      references public.casts (id, store_id)
      on delete cascade
      not valid;
  end if;
end
$migration$;

alter table public.customer_profiles
  validate constraint customer_profiles_customer_store_fkey;

alter table public.customer_followups
  validate constraint customer_followups_customer_store_fkey;

alter table public.customer_ng_casts
  validate constraint customer_ng_casts_customer_store_fkey;

alter table public.customer_ng_casts
  validate constraint customer_ng_casts_cast_store_fkey;

notify pgrst, 'reload schema';
