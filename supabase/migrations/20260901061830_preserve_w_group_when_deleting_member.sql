-- W枠の構成員を管理画面から削除するときは、W枠・予約・精算履歴を
-- 連動削除せず、個人枠だけを非表示のアーカイブ状態にする。
-- W枠そのもの、またはW枠と無関係な個人枠の削除は従来どおり物理削除する。
create or replace function public.delete_cast_with_w_groups(p_cast_id uuid)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_group_ids uuid[] := '{}'::uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select c.store_id
    into v_store_id
  from public.casts c
  where c.id = p_cast_id
  for update;

  if v_store_id is null then
    raise exception 'キャストが見つかりません';
  end if;

  if not public.can_manage_store(v_store_id) then
    raise exception 'キャストを削除する権限がありません' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct wm.group_cast_id), '{}'::uuid[])
    into v_group_ids
  from public.w_therapist_members wm
  where wm.member_cast_id = p_cast_id
    and wm.store_id = v_store_id;

  if cardinality(v_group_ids) > 0 then
    update public.casts c
    set is_active = false,
        is_visible = false,
        status = 'offline',
        updated_at = now()
    where c.id = p_cast_id
      and c.store_id = v_store_id;

    if not found then
      raise exception 'キャストをアーカイブできませんでした';
    end if;

    return array[p_cast_id];
  end if;

  delete from public.casts c
  where c.id = p_cast_id
    and c.store_id = v_store_id;

  if not found then
    raise exception 'キャストを削除できませんでした';
  end if;

  return array[p_cast_id];
end;
$$;

revoke all on function public.delete_cast_with_w_groups(uuid) from public;
revoke all on function public.delete_cast_with_w_groups(uuid) from anon;
grant execute on function public.delete_cast_with_w_groups(uuid) to authenticated;

comment on function public.delete_cast_with_w_groups(uuid) is
  'W構成員は履歴保全のためアーカイブし、それ以外は物理削除する管理者向けRPC。';