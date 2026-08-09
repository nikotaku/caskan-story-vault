-- 公開プロフィールに使う項目が変わったらエスたま同期を自動予約する。
-- 管理画面からの保存は即時実行し、それ以外の更新も毎分の安全な再試行で拾う。

alter table public.external_cast_profiles
  add column if not exists last_profile_hash text,
  add column if not exists last_photo_hash text,
  add column if not exists last_photo_count integer not null default 0;

-- 既存連携分は、次回の写真削除時に余った枠を消せるよう現在枚数だけ先に記録する。
update public.external_cast_profiles profile
set last_photo_count = current_photos.photo_count
from (
  select cast_row.id as cast_id,
         least(
           6,
           count(distinct image.photo_url)
             filter (where image.photo_url is not null and btrim(image.photo_url) <> '')
         )::integer as photo_count
  from public.casts cast_row
  left join lateral unnest(
    array_prepend(cast_row.photo, coalesce(cast_row.photos, '{}'::text[]))
  ) as image(photo_url) on true
  group by cast_row.id
) current_photos
where profile.cast_id = current_photos.cast_id
  and profile.provider = 'estama'
  and profile.sync_status = 'synced'
  and profile.last_photo_count = 0;

create index if not exists automation_jobs_estama_profile_queue_idx
  on public.automation_jobs (available_at, created_at)
  where provider = 'estama'
    and job_type = 'estama_register_cast'
    and status = 'queued';

create or replace function public.trg_enqueue_estama_cast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_changed_fields text[];
begin
  if tg_op = 'INSERT' then
    if coalesce(new.estama_auto_register, false) then
      perform public.enqueue_estama_job(
        new.store_id,
        'estama_register_cast',
        new.id,
        null,
        'estama:cast:' || new.id::text,
        jsonb_build_object('source', 'cast_insert', 'full_sync', true)
      );
    end if;
    return new;
  end if;

  if coalesce(new.estama_auto_register, false)
     and not coalesce(old.estama_auto_register, false)
     and not exists (
       select 1
       from public.external_cast_profiles profile
       where profile.cast_id = new.id
         and profile.provider = 'estama'
         and profile.sync_status = 'synced'
     ) then
    perform public.enqueue_estama_job(
      new.store_id,
      'estama_register_cast',
      new.id,
      null,
      'estama:cast:' || new.id::text,
      jsonb_build_object('source', 'auto_register_enabled', 'full_sync', true)
    );
  end if;

  v_old_profile := jsonb_build_object(
    'name', old.name,
    'photo', old.photo,
    'photos', old.photos,
    'shop_comment', old.shop_comment,
    'therapist_comment', old.therapist_comment,
    'profile', old.profile,
    'message', old.message,
    'therapist_years', old.therapist_years,
    'therapist_experience', old.therapist_experience,
    'age', old.age,
    'height', old.height,
    'bust_size', old.bust_size,
    'bust', old.bust,
    'cup_size', old.cup_size,
    'body_size', old.body_size,
    'waist', old.waist,
    'hip', old.hip,
    'blood_type', old.blood_type,
    'favorite_techniques', old.favorite_techniques,
    'favorite_food', old.favorite_food,
    'ideal_type', old.ideal_type,
    'celebrity_lookalike', old.celebrity_lookalike,
    'celebrity_like', old.celebrity_like,
    'day_off_activities', old.day_off_activities,
    'hobby', old.hobby,
    'hobbies', old.hobbies,
    'blog_url', old.blog_url,
    'x_account', old.x_account,
    'instagram_url', old.instagram_url,
    'features', old.features
  );
  v_new_profile := jsonb_build_object(
    'name', new.name,
    'photo', new.photo,
    'photos', new.photos,
    'shop_comment', new.shop_comment,
    'therapist_comment', new.therapist_comment,
    'profile', new.profile,
    'message', new.message,
    'therapist_years', new.therapist_years,
    'therapist_experience', new.therapist_experience,
    'age', new.age,
    'height', new.height,
    'bust_size', new.bust_size,
    'bust', new.bust,
    'cup_size', new.cup_size,
    'body_size', new.body_size,
    'waist', new.waist,
    'hip', new.hip,
    'blood_type', new.blood_type,
    'favorite_techniques', new.favorite_techniques,
    'favorite_food', new.favorite_food,
    'ideal_type', new.ideal_type,
    'celebrity_lookalike', new.celebrity_lookalike,
    'celebrity_like', new.celebrity_like,
    'day_off_activities', new.day_off_activities,
    'hobby', new.hobby,
    'hobbies', new.hobbies,
    'blog_url', new.blog_url,
    'x_account', new.x_account,
    'instagram_url', new.instagram_url,
    'features', new.features
  );

  select array_agg(entry.key order by entry.key)
    into v_changed_fields
  from jsonb_each(v_new_profile) entry
  where entry.value is distinct from (v_old_profile -> entry.key);

  if coalesce(cardinality(v_changed_fields), 0) = 0 then
    return new;
  end if;

  if exists (
    select 1
    from public.external_cast_profiles profile
    where profile.cast_id = new.id
      and profile.provider = 'estama'
      and profile.sync_status = 'synced'
  ) then
    perform public.enqueue_estama_job(
      new.store_id,
      'estama_register_cast',
      new.id,
      null,
      'estama:cast:' || new.id::text,
      jsonb_build_object(
        'source', 'profile_update',
        'changed_fields', to_jsonb(v_changed_fields)
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_estama_cast on public.casts;
drop trigger if exists trg_enqueue_estama_cast_update on public.casts;

create trigger trg_enqueue_estama_cast
after insert on public.casts
for each row execute function public.trg_enqueue_estama_cast();

create trigger trg_enqueue_estama_cast_update
after update of
  name, photo, photos, shop_comment, therapist_comment, profile, message,
  therapist_years, therapist_experience, age, height, bust_size, bust,
  cup_size, body_size, waist, hip, blood_type, favorite_techniques,
  favorite_food, ideal_type, celebrity_lookalike, celebrity_like,
  day_off_activities, hobby, hobbies, blog_url, x_account, instagram_url,
  features, estama_auto_register
on public.casts
for each row execute function public.trg_enqueue_estama_cast();

revoke all on function public.trg_enqueue_estama_cast() from public, anon, authenticated;

create or replace function public.claim_estama_profile_worker_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed_id uuid;
begin
  if p_token is null or length(p_token) < 48 then
    return false;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and purpose = 'profile-worker'
    and used_at is null
    and expires_at > now()
  returning id into v_claimed_id;

  return v_claimed_id is not null;
end;
$$;

revoke all on function public.claim_estama_profile_worker_token(text) from public, anon, authenticated;
grant execute on function public.claim_estama_profile_worker_token(text) to service_role;

create or replace function private.dispatch_estama_profile_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_token text;
  v_request_id bigint;
begin
  update public.automation_jobs
  set status = 'queued',
      available_at = now(),
      error_message = '前回のプロフィール同期が中断されたため自動再開しました',
      started_at = null
  where provider = 'estama'
    and job_type = 'estama_register_cast'
    and status = 'running'
    and started_at < now() - interval '7 minutes';

  if exists (
    select 1
    from public.automation_jobs job
    where job.provider = 'estama'
      and job.job_type = 'estama_register_cast'
      and job.status = 'running'
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.automation_jobs job
    where job.provider = 'estama'
      and job.job_type = 'estama_register_cast'
      and job.status = 'queued'
      and job.available_at <= now()
  ) then
    return null;
  end if;

  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    encode(extensions.digest(v_raw_token, 'sha256'), 'hex'),
    'profile-worker',
    now() + interval '10 minutes'
  );

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/automations/estama-profile-worker',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', v_raw_token),
    timeout_milliseconds := 300000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_estama_profile_sync() from public, anon, authenticated;
grant execute on function private.dispatch_estama_profile_sync() to service_role;

select cron.schedule(
  'estama-profile-sync-every-minute',
  '* * * * *',
  $cron$select private.dispatch_estama_profile_sync();$cron$
);
