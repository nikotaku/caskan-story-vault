-- Delete a cast and any W-therapist group casts that depend on it in one
-- transaction. The member foreign key is intentionally RESTRICT, so direct
-- deletes cannot leave a W group with only one member.
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

  -- Deleting the group first cascades its membership rows, which releases the
  -- RESTRICT reference on the individual cast.
  delete from public.casts c
  where c.id = any(v_group_ids)
    and c.store_id = v_store_id;

  delete from public.casts c
  where c.id = p_cast_id
    and c.store_id = v_store_id;

  if not found then
    raise exception 'キャストを削除できませんでした';
  end if;

  return v_group_ids || array[p_cast_id];
end;
$$;

revoke all on function public.delete_cast_with_w_groups(uuid) from public;
revoke all on function public.delete_cast_with_w_groups(uuid) from anon;
grant execute on function public.delete_cast_with_w_groups(uuid) to authenticated;
