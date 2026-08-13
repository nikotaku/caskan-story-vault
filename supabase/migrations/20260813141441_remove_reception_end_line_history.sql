-- 受付終了連絡は端末の共有画面へ移行したため、自動LINE送信専用の履歴を廃止する。
-- casts.line_group_id は他のLINE通知で利用中なので変更しない。
drop table if exists public.therapist_reception_end_notifications;
