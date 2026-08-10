alter table public.customer_reviews
  drop constraint if exists customer_reviews_rating_check;

alter table public.customer_reviews
  alter column rating type numeric(2,1)
  using rating::numeric(2,1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_reviews_rating_check'
      and conrelid = 'public.customer_reviews'::regclass
  ) then
    alter table public.customer_reviews
      add constraint customer_reviews_rating_check
      check (rating >= 1.0 and rating <= 5.0);
  end if;
end;
$$;

alter table public.customer_reviews
  add column if not exists reviewer_name text,
  add column if not exists review_title text,
  add column if not exists reviewed_at date,
  add column if not exists source_provider text,
  add column if not exists source_external_id text,
  add column if not exists source_url text,
  add column if not exists source_details jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_reviews_source_unique'
      and conrelid = 'public.customer_reviews'::regclass
  ) then
    alter table public.customer_reviews
      add constraint customer_reviews_source_unique
      unique (store_id, source_provider, source_external_id);
  end if;
end;
$$;

create index if not exists customer_reviews_public_feed_idx
  on public.customer_reviews (store_id, is_published, created_at desc);

comment on column public.customer_reviews.source_provider is
  'External review provider, for example estama. NULL means an HP-native review.';
comment on column public.customer_reviews.source_external_id is
  'Stable review identifier supplied by the external provider.';
comment on column public.customer_reviews.source_details is
  'Provider-specific structured metadata such as category scores.';

insert into public.customer_reviews (
  store_id,
  rating,
  therapist_name,
  review_text,
  allow_publish,
  created_at,
  is_published,
  reviewer_name,
  review_title,
  reviewed_at,
  source_provider,
  source_external_id,
  source_url,
  source_details,
  synced_at
)
select
  stores.id,
  4.5,
  '星乃りか',
  E'フリーで急遽予約しましたが、超絶かわいいりかちゃんにお出迎えされて、良い意味できたいをあらきられました！\n最高の施術でリラックスできましたよ\nまたリピ確定です！',
  true,
  timestamptz '2026-08-10 12:00:00+09',
  true,
  '手羽29',
  'かわいかったぁ',
  date '2026-08-10',
  'estama',
  '468117',
  'https://estama.jp/shop/51445/reviewlist/#review_468117',
  jsonb_build_object(
    'category_scores', jsonb_build_object(
      'ルックスS級', 5.0,
      '非日常感', 5.0,
      'ゴッドハンド指数', 3.0,
      '値段以上のサービス', 5.0,
      'ハイレベルなおもてなし', 5.0,
      'あぁぁぁぁぁ！', 4.0
    ),
    'visit_frequency', '初めて',
    'amount', null,
    'therapist_external_id', '928851',
    'therapist_profile_url', 'https://estama.jp/shop/51445/cast/928851/'
  ),
  now()
from public.stores
where stores.slug = 'tsuyaka'
on conflict (store_id, source_provider, source_external_id)
do update set
  rating = excluded.rating,
  therapist_name = excluded.therapist_name,
  review_text = excluded.review_text,
  allow_publish = true,
  is_published = true,
  reviewer_name = excluded.reviewer_name,
  review_title = excluded.review_title,
  reviewed_at = excluded.reviewed_at,
  source_url = excluded.source_url,
  source_details = excluded.source_details,
  synced_at = excluded.synced_at;

do $$
declare
  publishable_key text;
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'estama_review_sync_publishable_key'
  ) then
    select decrypted_secret
    into publishable_key
    from vault.decrypted_secrets
    where name = 'kintore_publishable_key';

    if publishable_key is null then
      raise exception 'The publishable key required for Estama review sync is not configured';
    end if;

    perform vault.create_secret(
      publishable_key,
      'estama_review_sync_publishable_key',
      'Publishable key for the scheduled sync-estama-reviews invocation'
    );
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'estama-review-sync-every-15-minutes'
  ) then
    perform cron.unschedule('estama-review-sync-every-15-minutes');
  end if;

  perform cron.schedule(
    'estama-review-sync-every-15-minutes',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := 'https://imrxzkivwrkqbhqfbbes.supabase.co/functions/v1/sync-estama-reviews',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'estama_review_sync_publishable_key'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      ) as request_id;
    $job$
  );
end;
$$;
