-- The casts table uses column-level privileges for authenticated users.
-- is_estama_dummy was added after those grants were established, so selecting
-- it from the monthly shift screen returned 403 and left the therapist picker empty.
grant select (is_estama_dummy) on table public.casts to authenticated;
