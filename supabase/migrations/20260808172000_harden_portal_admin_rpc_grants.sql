-- 本番適用済みの媒体連携RPCと旧トークン管理RPCから匿名実行権限を除去する。
revoke all on function public.get_site_connection_status_admin(uuid) from public, anon;
revoke all on function public.get_o2_connection_overview(uuid) from public, anon;
revoke all on function public.update_o2_linkage_admin(uuid, uuid, boolean, boolean, text) from public, anon;

grant execute on function public.get_site_connection_status_admin(uuid) to authenticated;
grant execute on function public.get_o2_connection_overview(uuid) to authenticated;
grant execute on function public.update_o2_linkage_admin(uuid, uuid, boolean, boolean, text) to authenticated;

revoke execute on function public.get_cast_access_tokens() from public, anon;
revoke execute on function public.set_cast_access_token(uuid, text) from public, anon;
grant execute on function public.get_cast_access_tokens() to authenticated;
grant execute on function public.set_cast_access_token(uuid, text) to authenticated;
