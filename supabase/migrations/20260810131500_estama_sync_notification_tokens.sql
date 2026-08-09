alter table public.estama_sync_tokens
  drop constraint if exists estama_sync_tokens_purpose_check;

alter table public.estama_sync_tokens
  add constraint estama_sync_tokens_purpose_check
  check (
    purpose = any (array['dispatcher'::text, 'worker'::text])
    or purpose ~ '^report:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or purpose ~ '^notify:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
