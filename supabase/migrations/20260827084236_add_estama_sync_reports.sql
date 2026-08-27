create table if not exists public.estama_sync_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shop_id text,
  status text not null check (status in ('success', 'warning', 'error')),
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  total_count integer not null default 0 check (total_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  cast_names text[] not null default '{}'::text[],
  summary text not null,
  results jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  missing_profiles text[] not null default '{}'::text[],
  fatal_error text,
  created_at timestamptz not null default now()
);

create index if not exists estama_sync_reports_store_created_idx
  on public.estama_sync_reports (store_id, created_at desc);

alter table public.estama_sync_reports enable row level security;

drop policy if exists estama_sync_reports_store_managers_read on public.estama_sync_reports;
create policy estama_sync_reports_store_managers_read
  on public.estama_sync_reports
  for select
  to authenticated
  using (public.can_manage_store(store_id));

revoke all on table public.estama_sync_reports from anon;
revoke insert, update, delete, truncate, references, trigger on table public.estama_sync_reports from authenticated;
grant select on table public.estama_sync_reports to authenticated;

comment on table public.estama_sync_reports is
  '管理画面で確認するエスたま同期結果。LINE通知の代替として証跡画像URLと結果を保持する。';
