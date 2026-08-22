alter table public.shifts
  add column if not exists estama_human_confirmed boolean not null default false,
  add column if not exists estama_confirmed_at timestamp with time zone,
  add column if not exists estama_confirmed_by uuid;

comment on column public.shifts.estama_registered is
  'エステ魂への自動同期と公開ページ確認が成功した状態';
comment on column public.shifts.estama_human_confirmed is
  '管理画面で人がエステ魂の公開表示を最終確認した状態';
comment on column public.shifts.estama_confirmed_at is
  'エステ魂の公開表示を人が最終確認した日時';
comment on column public.shifts.estama_confirmed_by is
  'エステ魂の公開表示を最終確認した管理者のユーザーID';

create or replace function public.set_estama_human_confirmation_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.cast_id is distinct from old.cast_id
    or new.shift_date is distinct from old.shift_date
    or new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.approval_status is distinct from old.approval_status
    or new.status is distinct from old.status
  ) then
    new.estama_human_confirmed := false;
  end if;

  if new.estama_human_confirmed then
    if tg_op = 'INSERT'
       or old.estama_human_confirmed is distinct from true
       or new.estama_confirmed_at is null then
      new.estama_confirmed_at := now();
      new.estama_confirmed_by := auth.uid();
    end if;
  else
    new.estama_confirmed_at := null;
    new.estama_confirmed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_estama_human_confirmation_metadata on public.shifts;
create trigger trg_set_estama_human_confirmation_metadata
before insert or update on public.shifts
for each row execute function public.set_estama_human_confirmation_metadata();

