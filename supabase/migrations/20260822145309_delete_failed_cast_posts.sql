create or replace function public.delete_admin_failed_cast_post(p_post_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post public.cast_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into v_post
  from public.cast_posts
  where id = p_post_id;

  if not found then
    raise exception '削除対象の投稿が見つかりません';
  end if;
  if not public.can_manage_store(v_post.store_id) then
    raise exception 'この店舗を管理する権限がありません';
  end if;

  -- Lock related jobs first so a queued worker cannot start while the post is deleted.
  perform 1
  from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text
  for update;

  select * into v_post
  from public.cast_posts
  where id = p_post_id
  for update;

  if coalesce(v_post.hp_status, 'skipped') = 'posted'
    or coalesce(v_post.o2_status, 'pending') = 'posted'
    or coalesce(v_post.esutama_status, 'pending') = 'posted' then
    raise exception '投稿済みの媒体があるため削除できません';
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

  delete from public.automation_jobs job
  where job.store_id = v_post.store_id
    and job.job_type = 'estama_post_diary'
    and job.payload->>'post_id' = p_post_id::text;

  delete from public.cast_posts
  where id = p_post_id;

  return true;
end;
$$;

revoke all on function public.delete_admin_failed_cast_post(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_admin_failed_cast_post(uuid) to authenticated;
