-- A shift always belongs to the same store as its therapist.
-- Service-role imports have no auth.uid(), so the generic store trigger can
-- otherwise fall back to the legacy store even for an Enka therapist.
create or replace function public.set_shift_store_id_from_cast()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_store_id uuid;
begin
  select c.store_id
    into v_store_id
  from public.casts c
  where c.id = new.cast_id;

  if v_store_id is not null then
    new.store_id := v_store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_shift_store_id_from_cast on public.shifts;
create trigger trg_shift_store_id_from_cast
before insert or update of cast_id on public.shifts
for each row
execute function public.set_shift_store_id_from_cast();

-- Preserve historical store attribution and only repair current/future rows.
update public.shifts s
set store_id = c.store_id
from public.casts c
where c.id = s.cast_id
  and s.shift_date >= (now() at time zone 'Asia/Tokyo')::date
  and s.store_id is distinct from c.store_id;
