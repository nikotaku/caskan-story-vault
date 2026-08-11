-- 旧案内画面もO2の共通IDを表示できるよう、表示用列を認証情報の正に揃える。
update public.casts c
set o2_login_id = credentials.login_id
from public.cast_site_credentials credentials
where credentials.cast_id = c.id
  and credentials.store_id = c.store_id
  and credentials.site = 'o2'
  and nullif(trim(credentials.login_id), '') is not null
  and c.o2_login_id is distinct from credentials.login_id;
