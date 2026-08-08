-- 管理RPCを呼び出しユーザー権限で実行し、認証情報テーブルのRLSで
-- 店舗管理者だけに読み書きを許可する。

drop policy if exists cast_site_credentials_store_managers_read
  on public.cast_site_credentials;
drop policy if exists cast_site_credentials_store_managers
  on public.cast_site_credentials;

create policy cast_site_credentials_store_managers
on public.cast_site_credentials
for all
to authenticated
using (public.can_manage_store(store_id))
with check (public.can_manage_store(store_id));

alter function public.get_sns_connection_overview(uuid)
  security invoker;
alter function public.save_sns_connection_admin(uuid, uuid, text, text, text, boolean, boolean)
  security invoker;
