-- O2・魂セラピスト同時投稿の「テスト投稿完了」チェックマーク機能。
-- 管理画面の媒体連携ステータスで、テスト投稿が完了したセラピストに
-- チェックマークを表示・手動でON/OFFできるようにする。

create table if not exists public.cast_test_post_completions (
  cast_id     uuid not null references public.casts(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  site        text not null check (site in ('o2', 'esutama')),
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  primary key (cast_id, site)
);

create index if not exists cast_test_post_completions_store_id_idx
  on public.cast_test_post_completions (store_id);

alter table public.cast_test_post_completions enable row level security;

-- 読み取りは店舗スタッフ以上、書き込みはオーナー/マネージャーのみ。
drop policy if exists cast_test_post_completions_select on public.cast_test_post_completions;
create policy cast_test_post_completions_select
  on public.cast_test_post_completions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_stores membership
      where membership.user_id = auth.uid()
        and membership.store_id = cast_test_post_completions.store_id
    )
  );

drop policy if exists cast_test_post_completions_insert on public.cast_test_post_completions;
create policy cast_test_post_completions_insert
  on public.cast_test_post_completions
  for insert
  to authenticated
  with check (public.can_manage_store(store_id));

drop policy if exists cast_test_post_completions_update on public.cast_test_post_completions;
create policy cast_test_post_completions_update
  on public.cast_test_post_completions
  for update
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists cast_test_post_completions_delete on public.cast_test_post_completions;
create policy cast_test_post_completions_delete
  on public.cast_test_post_completions
  for delete
  to authenticated
  using (public.can_manage_store(store_id));

-- テスト完了フラグのON/OFFを行う管理RPC。
create or replace function public.set_cast_test_post_completion(
  p_store_id uuid,
  p_cast_id uuid,
  p_site text,
  p_completed boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed_at timestamptz;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception using
      message = 'この店舗を管理する権限がありません',
      errcode = '42501';
  end if;
  if p_site is null or p_site not in ('o2', 'esutama') then
    raise exception using
      message = '対象媒体が正しくありません',
      errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.casts c
    where c.id = p_cast_id
      and c.store_id = p_store_id
  ) then
    raise exception using
      message = '対象セラピストが見つかりません',
      errcode = 'P0002';
  end if;

  if p_completed then
    insert into public.cast_test_post_completions (
      cast_id, store_id, site, completed_at, completed_by
    ) values (
      p_cast_id, p_store_id, p_site, now(), auth.uid()
    )
    on conflict (cast_id, site)
    do update set
      completed_at = excluded.completed_at,
      completed_by = excluded.completed_by
    returning completed_at into v_completed_at;
  else
    delete from public.cast_test_post_completions
    where cast_id = p_cast_id
      and store_id = p_store_id
      and site = p_site;
    v_completed_at := null;
  end if;

  return v_completed_at;
end;
$$;

revoke all on function public.set_cast_test_post_completion(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_cast_test_post_completion(uuid, uuid, text, boolean)
  to authenticated;
