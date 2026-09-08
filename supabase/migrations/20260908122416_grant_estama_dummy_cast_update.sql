-- is_estama_dummy was added after casts switched to column-level privileges.
-- The monthly shift picker could read the flag but could not save changes.
grant update (is_estama_dummy)
on table public.casts
to authenticated;
