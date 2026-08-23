-- Keep Estama-only sample availability separate from real store shifts.
-- These rows are visible to store managers and are never used by the public HP.

alter table public.casts
  add column if not exists is_estama_dummy boolean not null default false;

update public.casts
set is_estama_dummy = true
where name in ('蒼井かずは', '華咲れみ', '萩原ゆの');

create index if not exists casts_estama_dummy_store_idx
  on public.casts (store_id, display_order, name)
  where is_estama_dummy = true;

create table if not exists public.estama_dummy_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cast_id uuid not null references public.casts(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  estama_registered boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estama_dummy_shifts_cast_date_key unique (cast_id, shift_date)
);

create index if not exists estama_dummy_shifts_store_date_idx
  on public.estama_dummy_shifts (store_id, shift_date, cast_id);

alter table public.estama_dummy_shifts enable row level security;

revoke all on table public.estama_dummy_shifts from anon, authenticated;
grant select, insert, update, delete on table public.estama_dummy_shifts to authenticated;
grant all on table public.estama_dummy_shifts to service_role;

drop policy if exists "Store managers can view Estama dummy shifts" on public.estama_dummy_shifts;
create policy "Store managers can view Estama dummy shifts"
on public.estama_dummy_shifts
for select
to authenticated
using (
  (select public.can_manage_store(store_id))
);

drop policy if exists "Store managers can insert Estama dummy shifts" on public.estama_dummy_shifts;
create policy "Store managers can insert Estama dummy shifts"
on public.estama_dummy_shifts
for insert
to authenticated
with check (
  (select public.can_manage_store(store_id))
);

drop policy if exists "Store managers can update Estama dummy shifts" on public.estama_dummy_shifts;
create policy "Store managers can update Estama dummy shifts"
on public.estama_dummy_shifts
for update
to authenticated
using (
  (select public.can_manage_store(store_id))
)
with check (
  (select public.can_manage_store(store_id))
);

drop policy if exists "Store managers can delete Estama dummy shifts" on public.estama_dummy_shifts;
create policy "Store managers can delete Estama dummy shifts"
on public.estama_dummy_shifts
for delete
to authenticated
using (
  (select public.can_manage_store(store_id))
);

drop trigger if exists trg_estama_dummy_shift_store_id_from_cast on public.estama_dummy_shifts;
create trigger trg_estama_dummy_shift_store_id_from_cast
before insert or update of cast_id on public.estama_dummy_shifts
for each row
execute function public.set_shift_store_id_from_cast();

drop trigger if exists trg_update_estama_dummy_shifts_updated_at on public.estama_dummy_shifts;
create trigger trg_update_estama_dummy_shifts_updated_at
before update on public.estama_dummy_shifts
for each row
execute function public.update_updated_at_column();

-- Queue only the 14-day range accepted by the Estama schedule screen.
-- The daily reconciliation picks up later rows when they enter this window.
create or replace function public.trg_enqueue_estama_dummy_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.estama_dummy_shifts%rowtype;
  v_action text;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if tg_op = 'UPDATE'
     and new.cast_id is not distinct from old.cast_id
     and new.shift_date is not distinct from old.shift_date
     and new.start_time is not distinct from old.start_time
     and new.end_time is not distinct from old.end_time then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (new.shift_date is distinct from old.shift_date or new.cast_id is distinct from old.cast_id)
     and old.shift_date between v_today and v_today + 13
     and exists (
       select 1
       from public.external_cast_profiles profile
       where profile.cast_id = old.cast_id
         and profile.provider = 'estama'
         and profile.sync_status = 'synced'
     ) then
    perform public.enqueue_estama_job(
      old.store_id,
      'estama_sync_shift',
      old.cast_id,
      null,
      'estama:dummy:old:' || old.id::text || ':' || old.shift_date::text,
      jsonb_build_object(
        'source', 'dummy_shift_update_old_value',
        'action', 'delete',
        'dummy_shift_id', old.id,
        'cast_id', old.cast_id,
        'shift_date', old.shift_date,
        'start_time', old.start_time,
        'end_time', old.end_time
      )
    );
  end if;

  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'delete';
  else
    v_row := new;
    v_action := 'upsert';
  end if;

  if v_row.shift_date < v_today or v_row.shift_date > v_today + 13 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.external_cast_profiles profile
    where profile.cast_id = v_row.cast_id
      and profile.provider = 'estama'
      and profile.sync_status = 'synced'
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  perform public.enqueue_estama_job(
    v_row.store_id,
    'estama_sync_shift',
    v_row.cast_id,
    null,
    'estama:dummy:' || v_row.id::text,
    jsonb_build_object(
      'source', 'dummy_shift_' || lower(tg_op),
      'action', v_action,
      'dummy_shift_id', v_row.id,
      'cast_id', v_row.cast_id,
      'shift_date', v_row.shift_date,
      'start_time', v_row.start_time,
      'end_time', v_row.end_time
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.trg_enqueue_estama_dummy_shift() from public, anon, authenticated;

drop trigger if exists trg_enqueue_estama_dummy_shift on public.estama_dummy_shifts;
create trigger trg_enqueue_estama_dummy_shift
after insert or update or delete on public.estama_dummy_shifts
for each row
execute function public.trg_enqueue_estama_dummy_shift();

-- The edge worker reports by automation job. Use the payload's dummy_shift_id
-- when the job intentionally has no shifts foreign key.
create or replace function public.report_estama_shift_result(
  p_token text,
  p_job_id uuid,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
  job_row public.automation_jobs%rowtype;
  result_ok boolean := false;
  result_action text;
  error_text text;
  dummy_shift_id uuid;
begin
  if p_token is null or length(p_token) < 48 or p_job_id is null then
    return false;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and purpose = 'report:' || p_job_id::text
    and used_at is null
    and expires_at > now()
  returning id into claimed_id;

  if claimed_id is null then
    return false;
  end if;

  select *
  into job_row
  from public.automation_jobs
  where id = p_job_id
    and provider = 'estama'
    and job_type = 'estama_sync_shift';

  if not found then
    return false;
  end if;

  result_ok := coalesce((p_result ->> 'ok')::boolean, false);
  result_action := coalesce(nullif(p_result ->> 'action', ''), 'upsert');
  error_text := nullif(left(coalesce(p_result ->> 'error', '同期に失敗しました'), 1000), '');

  update public.automation_jobs
  set status = case when result_ok then 'completed' else 'failed' end,
      result = case when result_ok then p_result else '{}'::jsonb end,
      error_message = case when result_ok then null else error_text end,
      finished_at = now()
  where id = p_job_id;

  if job_row.shift_id is not null then
    update public.shifts
    set estama_registered = result_ok and result_action = 'upsert'
    where id = job_row.shift_id;
  end if;

  begin
    dummy_shift_id := nullif(job_row.payload ->> 'dummy_shift_id', '')::uuid;
  exception when invalid_text_representation then
    dummy_shift_id := null;
  end;

  if dummy_shift_id is not null then
    update public.estama_dummy_shifts
    set estama_registered = result_ok and result_action = 'upsert'
    where id = dummy_shift_id;
  end if;

  if job_row.cast_id is not null then
    update public.external_cast_profiles
    set last_shift_sync_at = case when result_ok then now() else last_shift_sync_at end,
        last_error = case when result_ok then null else error_text end
    where cast_id = job_row.cast_id
      and provider = 'estama';
  end if;

  update public.automation_connections
  set last_reconciled_at = now(),
      last_error = case when result_ok then last_error else error_text end,
      status = case
        when not result_ok and coalesce(error_text, '') ~ '再ログイン|ログイン' then 'expired'
        else status
      end
  where store_id = job_row.store_id
    and provider = 'estama';

  return true;
end;
$$;

revoke all on function public.report_estama_shift_result(text, uuid, jsonb) from public;
grant execute on function public.report_estama_shift_result(text, uuid, jsonb)
  to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'estama_dummy_shifts'
  ) then
    alter publication supabase_realtime add table public.estama_dummy_shifts;
  end if;
end;
$$;
