-- payment_settings の payment_method ユニーク制約を店舗単位の複合ユニークに変更
-- （シングルテナント時代の制約が残っており、2店舗目に同名の決済方法を登録できなかった）
alter table payment_settings drop constraint payment_settings_payment_method_key;
alter table payment_settings add constraint payment_settings_store_method_key unique (store_id, payment_method);
