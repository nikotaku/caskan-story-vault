-- 投稿履歴の削除時に、行ロック後の対象情報だけを返す。
-- 他の投稿が同じURLを参照している画像はStorage削除候補から除外する。
create or replace function public.delete_admin_failed_cast_post_with_assets(p_post_id uuid)
returns table(store_id uuid, cast_id uuid, image_urls text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post public.cast_posts%rowtype;
  v_unreferenced_images text[];
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into v_post
  from public.cast_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception '削除対象の投稿が見つかりません';
  end if;
  if not public.can_manage_store(v_post.store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  perform 1
  from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text
  for update;

  if coalesce(v_post.esutama_error, '') like '【要確認・再送停止】%' then
    raise exception '魂セラピスト側の掲載有無を確認するまで、この投稿は削除できません';
  end if;
  if coalesce(v_post.o2_status, '') = 'posting'
    or coalesce(v_post.esutama_status, '') = 'posting'
    or exists (
      select 1
      from public.automation_jobs job
      where job.store_id = v_post.store_id
        and job.job_type = 'estama_post_diary'
        and job.payload->>'post_id' = p_post_id::text
        and job.status = 'running'
    ) then
    raise exception '送信処理中のため削除できません。完了後にもう一度お試しください';
  end if;
  if not (
    v_post.status = 'failed'
    or coalesce(v_post.o2_status, '') in ('failed', 'skipped')
    or coalesce(v_post.esutama_status, '') in ('failed', 'skipped')
    or v_post.o2_error is not null
    or v_post.esutama_error is not null
  ) then
    raise exception '送信エラーのない投稿は削除できません';
  end if;

  select coalesce(array_agg(distinct target.url), '{}'::text[])
    into v_unreferenced_images
  from unnest(coalesce(v_post.image_urls, '{}'::text[])) as target(url)
  where not exists (
    select 1
    from public.cast_posts other
    where other.id <> p_post_id
      and other.image_urls @> array[target.url]
  );

  delete from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text;

  delete from public.cast_posts where id = p_post_id;

  store_id := v_post.store_id;
  cast_id := v_post.cast_id;
  image_urls := v_unreferenced_images;
  return next;
end;
$$;

revoke all on function public.delete_admin_failed_cast_post_with_assets(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_admin_failed_cast_post_with_assets(uuid)
  to authenticated;

-- 旧画面との互換性を保ちつつ、削除条件を1か所に集約する。
create or replace function public.delete_admin_failed_cast_post(p_post_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform * from public.delete_admin_failed_cast_post_with_assets(p_post_id);
  return true;
end;
$$;

revoke all on function public.delete_admin_failed_cast_post(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_admin_failed_cast_post(uuid)
  to authenticated;

-- 匿名アップロードを閉じる。投稿用ディレクトリは店舗管理者だけが操作でき、
-- セラピスト本人用 posts/ はservice role経由だけに限定する。
drop policy if exists "cast-photos any upload" on storage.objects;
drop policy if exists "Authenticated users can upload cast photos" on storage.objects;
drop policy if exists "Authenticated users can update cast photos" on storage.objects;
drop policy if exists "Authenticated users can delete cast photos" on storage.objects;
drop policy if exists cast_photos_authenticated_insert on storage.objects;
drop policy if exists cast_photos_authenticated_update on storage.objects;
drop policy if exists cast_photos_authenticated_delete on storage.objects;

create policy cast_photos_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cast-photos'
    and (
      name !~ '^(admin-posts|posts)/'
      or (
        name ~ '^admin-posts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
        and public.can_manage_store(split_part(name, '/', 2)::uuid)
      )
    )
  );

create policy cast_photos_authenticated_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cast-photos'
    and (
      name !~ '^(admin-posts|posts)/'
      or (
        name ~ '^admin-posts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
        and public.can_manage_store(split_part(name, '/', 2)::uuid)
      )
    )
  )
  with check (
    bucket_id = 'cast-photos'
    and (
      name !~ '^(admin-posts|posts)/'
      or (
        name ~ '^admin-posts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
        and public.can_manage_store(split_part(name, '/', 2)::uuid)
      )
    )
  );

create policy cast_photos_authenticated_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cast-photos'
    and (
      name !~ '^(admin-posts|posts)/'
      or (
        name ~ '^admin-posts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
        and public.can_manage_store(split_part(name, '/', 2)::uuid)
      )
    )
  );
