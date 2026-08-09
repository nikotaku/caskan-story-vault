-- Public Estama pages contain no private data. Only the service-role Edge Function can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estama-sync-evidence',
  'estama-sync-evidence',
  true,
  2097152,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

