-- 顧客へのメルマガは明示的な配信同意を持つアドレスだけを対象にする。
alter table public.customers
  add column if not exists newsletter_opt_in boolean not null default false,
  add column if not exists newsletter_opt_out_token uuid not null default gen_random_uuid();

comment on column public.customers.newsletter_opt_in is
  'マーケティングメールの配信に明示的に同意しているか。';
comment on column public.customers.newsletter_opt_out_token is
  '配信停止URLで使用する、顧客ごとの推測困難なトークン。';

create unique index if not exists customers_newsletter_opt_out_token_key
  on public.customers (newsletter_opt_out_token);

create index if not exists customers_newsletter_recipients_idx
  on public.customers (store_id, email)
  where newsletter_opt_in = true
    and email is not null
    and coalesce(is_banned, false) = false;

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body_text text not null check (char_length(trim(body_text)) between 1 and 20000),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'partial', 'failed')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists newsletter_campaigns_store_created_idx
  on public.newsletter_campaigns (store_id, created_at desc);

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  recipient_email text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists newsletter_deliveries_campaign_status_idx
  on public.newsletter_deliveries (campaign_id, status);

alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_deliveries enable row level security;

revoke all on table public.newsletter_campaigns from anon;
revoke all on table public.newsletter_deliveries from anon;
grant select, insert, update, delete on table public.newsletter_campaigns to authenticated;
grant select on table public.newsletter_deliveries to authenticated;
grant all on table public.newsletter_campaigns to service_role;
grant all on table public.newsletter_deliveries to service_role;

drop policy if exists "Store managers can manage newsletter campaigns" on public.newsletter_campaigns;
create policy "Store managers can manage newsletter campaigns"
  on public.newsletter_campaigns
  for all
  to authenticated
  using ((select public.can_manage_store(store_id)))
  with check ((select public.can_manage_store(store_id)));

drop policy if exists "Store managers can view newsletter deliveries" on public.newsletter_deliveries;
create policy "Store managers can view newsletter deliveries"
  on public.newsletter_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.newsletter_campaigns campaign
      where campaign.id = newsletter_deliveries.campaign_id
        and public.can_manage_store(campaign.store_id)
    )
  );

-- エスタマ用のダミーキャスト名として実在キャストを名前で一括指定していたため、
-- 萩原ゆのが通常シフト一覧から除外されていた。実在キャストとして通常シフトに復帰させる。
update public.casts
set is_estama_dummy = false
where name = '萩原ゆの'
  and is_estama_dummy = true;

-- 新規の更新日時はアプリケーションおよび配信処理で明示的に更新する。
