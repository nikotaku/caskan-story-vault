create table if not exists public.dispatch_registration_forms (
  store_id uuid primary key references public.stores(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.dispatch_registrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  form_id uuid not null references public.dispatch_registration_forms(token) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  dispatch_start date not null,
  dispatch_end date not null,
  entry_source text not null check (entry_source in ('ネット媒体', 'エステ魂', 'HP')),
  created_at timestamp with time zone not null default now(),
  constraint dispatch_registrations_period_check check (dispatch_end >= dispatch_start)
);

create index if not exists dispatch_registrations_store_created_idx
  on public.dispatch_registrations (store_id, created_at desc);
create index if not exists dispatch_registrations_form_id_idx
  on public.dispatch_registrations (form_id);

alter table public.dispatch_registration_forms enable row level security;
alter table public.dispatch_registrations enable row level security;

grant select, insert, update on public.dispatch_registration_forms to authenticated;
grant select, update, delete on public.dispatch_registrations to authenticated;
grant all on public.dispatch_registration_forms to service_role;
grant all on public.dispatch_registrations to service_role;

create policy "dispatch_forms_manage_own_store"
on public.dispatch_registration_forms
for all
to authenticated
using (public.can_manage_store(store_id))
with check (public.can_manage_store(store_id));

create policy "dispatch_registrations_read_own_store"
on public.dispatch_registrations
for select
to authenticated
using (public.can_manage_store(store_id));

create policy "dispatch_registrations_update_own_store"
on public.dispatch_registrations
for update
to authenticated
using (public.can_manage_store(store_id))
with check (public.can_manage_store(store_id));

create policy "dispatch_registrations_delete_own_store"
on public.dispatch_registrations
for delete
to authenticated
using (public.can_manage_store(store_id));

insert into public.dispatch_registration_forms (store_id)
select id from public.stores where is_active = true
on conflict (store_id) do nothing;

create or replace function public.submit_dispatch_registration(
  p_token uuid,
  p_name text,
  p_dispatch_start date,
  p_dispatch_end date,
  p_entry_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.dispatch_registration_forms%rowtype;
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'お名前を入力してください';
  end if;
  if p_dispatch_start is null or p_dispatch_end is null or p_dispatch_end < p_dispatch_start then
    raise exception '派遣期間を正しく入力してください';
  end if;
  if p_dispatch_end - p_dispatch_start > 180 then
    raise exception '派遣期間は180日以内で入力してください';
  end if;
  if p_entry_source not in ('ネット媒体', 'エステ魂', 'HP') then
    raise exception '入店経由を選択してください';
  end if;

  select * into v_form
  from public.dispatch_registration_forms
  where token = p_token and is_active = true;

  if not found then
    raise exception 'この派遣登録フォームは現在利用できません';
  end if;

  insert into public.dispatch_registrations (
    store_id, form_id, name, dispatch_start, dispatch_end, entry_source
  ) values (
    v_form.store_id, v_form.token, v_name, p_dispatch_start, p_dispatch_end, p_entry_source
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_dispatch_registration(uuid, text, date, date, text) from public;
grant execute on function public.submit_dispatch_registration(uuid, text, date, date, text) to anon, authenticated;

comment on table public.dispatch_registration_forms is '店舗ごとの派遣登録用公開フォーム';
comment on table public.dispatch_registrations is '公開フォームから受け付けた派遣登録';
