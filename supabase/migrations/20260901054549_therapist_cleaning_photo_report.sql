-- Photo-backed end-of-shift cleaning reports.
alter table public.cleaning_checklists
  add column if not exists room_name text,
  add column if not exists room_photo_path text,
  add column if not exists water_area_photo_path text,
  add column if not exists laundry_started boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists notification_status text not null default 'not_attempted',
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_last_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cleaning_checklists_notification_status_check'
      and conrelid = 'public.cleaning_checklists'::regclass
  ) then
    alter table public.cleaning_checklists
      add constraint cleaning_checklists_notification_status_check
      check (notification_status in ('not_attempted', 'sending', 'sent', 'failed'));
  end if;
end;
$$;

create index if not exists cleaning_checklists_store_date_idx
  on public.cleaning_checklists (store_id, date desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cleaning-reports',
  'cleaning-reports',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

comment on column public.cleaning_checklists.room_photo_path is
  'Private cleaning-reports bucket path for the room completion photo.';
comment on column public.cleaning_checklists.water_area_photo_path is
  'Private cleaning-reports bucket path for the water-area completion photo.';
comment on column public.cleaning_checklists.notification_status is
  'Delivery state for the LINE operations-group notification.';
