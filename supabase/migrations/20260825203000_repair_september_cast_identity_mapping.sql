-- Repair the September 2026 shifts that were left under archived cast records.
--
-- Keep history before 2026-08-25 attached to the original cast records. From the
-- repair date onward, shifts belong to the current cast identities and Enka store.
-- The statements are intentionally idempotent so this migration is safe after the
-- production hotfix has already been applied.

do $repair$
declare
  v_enka_store uuid := '404499ab-5350-490f-9608-5814faffda6f';
  v_cutoff date := date '2026-08-25';

  v_old_ena uuid := 'f14747bd-d9d0-4eb2-932e-adbaa8b6188b';
  v_mochizuki_sena uuid := '52e9f3a1-7be3-4228-8b01-60d2cb1c20a5';

  v_old_shirosaki_ai uuid := 'e6662fdf-49da-4393-9f12-90ebbff1702b';
  v_kiryu_mai uuid := '7814d8e8-d763-4b8e-ab01-a911afdee924';

  v_hasegawa_rei uuid := '290ed943-7804-42e0-92d9-82efda9f4467';
  v_hasegawa_duplicate_1 uuid := '71b314d4-e8b8-4a0d-b370-1cbf70286a9e';
  v_hasegawa_duplicate_2 uuid := '2ee34e03-ab01-41fe-926f-ccddd4526ca1';
  v_now timestamptz := now();
begin
  if not exists (
    select 1
    from public.casts
    where id = v_mochizuki_sena
      and name = '望月せな'
      and store_id = v_enka_store
  ) then
    raise exception 'Expected Enka cast 望月せな (%) was not found', v_mochizuki_sena;
  end if;

  if not exists (
    select 1
    from public.casts
    where id = v_kiryu_mai
      and name = '桐生まい'
      and store_id = v_enka_store
  ) then
    raise exception 'Expected Enka cast 桐生まい (%) was not found', v_kiryu_mai;
  end if;

  if not exists (
    select 1
    from public.casts
    where id = v_hasegawa_rei
      and name = '長谷川れい'
  ) then
    raise exception 'Expected canonical cast 長谷川れい (%) was not found', v_hasegawa_rei;
  end if;

  if exists (
    select 1
    from public.shifts source_shift
    join public.shifts target_shift
      on target_shift.cast_id = v_mochizuki_sena
     and target_shift.shift_date = source_shift.shift_date
     and target_shift.start_time = source_shift.start_time
    where source_shift.cast_id = v_old_ena
      and source_shift.shift_date >= v_cutoff

    union all

    select 1
    from public.shifts source_shift
    join public.shifts target_shift
      on target_shift.cast_id = v_kiryu_mai
     and target_shift.shift_date = source_shift.shift_date
     and target_shift.start_time = source_shift.start_time
    where source_shift.cast_id = v_old_shirosaki_ai
      and source_shift.shift_date >= v_cutoff
  ) then
    raise exception 'A destination shift already exists for one of the cast identity migrations';
  end if;

  update public.shifts
  set cast_id = v_mochizuki_sena,
      store_id = v_enka_store,
      estama_registered = false,
      esran_registered = false,
      estama_human_confirmed = false,
      estama_confirmed_at = null,
      estama_confirmed_by = null,
      updated_at = v_now
  where cast_id = v_old_ena
    and shift_date >= v_cutoff;

  update public.shifts
  set cast_id = v_kiryu_mai,
      store_id = v_enka_store,
      estama_registered = false,
      esran_registered = false,
      estama_human_confirmed = false,
      estama_confirmed_at = null,
      estama_confirmed_by = null,
      updated_at = v_now
  where cast_id = v_old_shirosaki_ai
    and shift_date >= v_cutoff;

  update public.casts
  set store_id = v_enka_store,
      updated_at = v_now
  where id = v_hasegawa_rei
    and store_id is distinct from v_enka_store;

  update public.shifts
  set store_id = v_enka_store,
      estama_registered = false,
      esran_registered = false,
      estama_human_confirmed = false,
      estama_confirmed_at = null,
      estama_confirmed_by = null,
      updated_at = v_now
  where cast_id = v_hasegawa_rei
    and shift_date >= v_cutoff
    and store_id is distinct from v_enka_store;

  update public.casts
  set is_active = false,
      is_visible = false,
      updated_at = v_now
  where id in (
    v_old_ena,
    v_old_shirosaki_ai,
    v_hasegawa_duplicate_1,
    v_hasegawa_duplicate_2
  )
    and (is_active is distinct from false or is_visible is distinct from false);

  update public.automation_jobs
  set status = 'cancelled',
      error_message = 'Cancelled because the duplicate 長谷川れい cast record was archived.',
      finished_at = coalesce(finished_at, v_now),
      updated_at = v_now
  where cast_id in (v_hasegawa_duplicate_1, v_hasegawa_duplicate_2)
    and status = 'waiting_for_login';
end
$repair$;
