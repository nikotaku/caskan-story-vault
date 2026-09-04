-- 初回適用済み環境でも、呼び出し元のRLSを必ず適用する。
alter function public.complete_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, integer, text
) security invoker;
