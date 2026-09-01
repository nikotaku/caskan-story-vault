create index if not exists cleaning_checklists_cast_date_idx
  on public.cleaning_checklists (cast_id, date desc);
