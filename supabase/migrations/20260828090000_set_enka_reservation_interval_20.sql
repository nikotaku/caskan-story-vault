begin;

lock table public.shop_settings in share row exclusive mode;

do $$
declare
  enka_settings_count integer;
begin
  select count(*)
    into enka_settings_count
    from public.shop_settings
   where store_id = '404499ab-5350-490f-9608-5814faffda6f'::uuid;

  if enka_settings_count > 1 then
    raise exception 'duplicate shop_settings rows for 艶華: %', enka_settings_count;
  elsif enka_settings_count = 1 then
    update public.shop_settings
       set reservation_interval_minutes = 20,
           updated_at = now()
     where store_id = '404499ab-5350-490f-9608-5814faffda6f'::uuid
       and reservation_interval_minutes is distinct from 20;
  else
    insert into public.shop_settings (
      shop_name,
      store_id,
      reservation_interval_minutes
    ) values (
      '艶華',
      '404499ab-5350-490f-9608-5814faffda6f'::uuid,
      20
    );
  end if;
end
$$;

commit;
