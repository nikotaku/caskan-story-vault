-- 店舗管理者向けRLS/RPCの共通判定。後続migrationより先に定義する。
create or replace function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_stores
    where user_id = auth.uid()
      and store_id = p_store_id
      and role in ('owner', 'manager')
  )
$$;
