-- Keep SMS templates separated by store and seed the Enka thank-you SMS.

alter table public.sms_auto_templates
  add column if not exists store_id uuid;

update public.sms_auto_templates
set store_id = '00000000-0000-0000-0000-000000000001'::uuid
where store_id is null;

alter table public.sms_auto_templates
  alter column store_id set default '00000000-0000-0000-0000-000000000001'::uuid,
  alter column store_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sms_auto_templates'::regclass
      and conname = 'sms_auto_templates_store_id_fkey'
  ) then
    alter table public.sms_auto_templates
      add constraint sms_auto_templates_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
end
$$;

create index if not exists idx_sms_auto_templates_store_id
  on public.sms_auto_templates(store_id);

drop trigger if exists trg_set_store_id on public.sms_auto_templates;
create trigger trg_set_store_id
before insert on public.sms_auto_templates
for each row execute function public.set_store_id();

drop policy if exists "store_isolation" on public.sms_auto_templates;
create policy "store_isolation" on public.sms_auto_templates
  as restrictive
  for all
  to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

do $$
declare
  enka_store_id constant uuid := '404499ab-5350-490f-9608-5814faffda6f'::uuid;
  enka_message constant text := E'本日は艶華へご来店いただき、ありがとうございました。\n\n施術はいかがでしたでしょうか？\n\nより良いお店づくりのため、ぜひお客様のご感想をお聞かせください。\n\n▼アンケートはこちら\nhttps://enka-salon.jp/survey\n\n▼口コミはこちら\nhttps://enka-salon.jp/review\n\n【ご協力特典】\nアンケートまたは口コミのどちらか1つご回答で\n▶ 次回1,000円割引\n\nアンケート＋口コミの両方ご協力で\n▶ 次回3,000円割引\n\n※ご利用の際は、回答完了画面をスタッフまでご提示ください。\n\nまたのご来店を心よりお待ちしております。\n\n艶華';
begin
  if exists (
    select 1
    from public.sms_auto_templates
    where store_id = enka_store_id
      and trigger = 'thanks'
  ) then
    update public.sms_auto_templates
    set name = 'サンクスSMS',
        timing_minutes = 0,
        message = enka_message,
        is_active = true
    where store_id = enka_store_id
      and trigger = 'thanks';
  else
    insert into public.sms_auto_templates (
      name,
      trigger,
      timing_minutes,
      message,
      is_active,
      store_id
    ) values (
      'サンクスSMS',
      'thanks',
      0,
      enka_message,
      true,
      enka_store_id
    );
  end if;
end
$$;
