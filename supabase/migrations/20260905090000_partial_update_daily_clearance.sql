-- 日別清算の「途中保存」用RPC
-- 給与の不足分・追加支給など、入力途中の項目だけを daily_clearances に部分保存する。
-- complete_daily_clearance とは異なり、予約の完了・売上報告の承認・ポイント加算は行わない。
-- 行が存在しなければ status='draft'・cleared_at=NULL で新規作成するため、
-- 既存の「清算済み」判定（cleared_at の有無）には影響しない。
create or replace function public.partial_update_daily_clearance(
  p_cast_id uuid,
  p_date date,
  p_total_sales integer default null,
  p_therapist_back integer default null,
  p_misc_expenses integer default null,
  p_accommodation_fee integer default null,
  p_transportation_fee integer default null,
  p_other_expenses jsonb default null,
  p_payout_method text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.daily_clearances (
    cast_id,
    date,
    total_sales,
    therapist_back,
    misc_expenses,
    accommodation_fee,
    transportation_fee,
    other_expenses,
    payout_method,
    status,
    points_awarded
  ) values (
    p_cast_id,
    p_date,
    coalesce(p_total_sales, 0),
    coalesce(p_therapist_back, 0),
    coalesce(p_misc_expenses, 0),
    coalesce(p_accommodation_fee, 0),
    coalesce(p_transportation_fee, 0),
    coalesce(p_other_expenses, '[]'::jsonb),
    nullif(trim(coalesce(p_payout_method, '')), ''),
    'draft',
    0
  )
  on conflict (cast_id, date) do update
  set total_sales        = coalesce(p_total_sales, daily_clearances.total_sales),
      therapist_back     = coalesce(p_therapist_back, daily_clearances.therapist_back),
      misc_expenses      = coalesce(p_misc_expenses, daily_clearances.misc_expenses),
      accommodation_fee  = coalesce(p_accommodation_fee, daily_clearances.accommodation_fee),
      transportation_fee = coalesce(p_transportation_fee, daily_clearances.transportation_fee),
      other_expenses     = coalesce(p_other_expenses, daily_clearances.other_expenses),
      payout_method      = coalesce(nullif(trim(coalesce(p_payout_method, '')), ''), daily_clearances.payout_method);
  -- status / cleared_at / points_awarded / payout_amount は既存行を維持する
end;
$$;

comment on function public.partial_update_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, text
) is '日別清算の入力途中項目を部分保存する。予約完了や清算確定は行わない。';

revoke all on function public.partial_update_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, text
) from public, anon;
grant execute on function public.partial_update_daily_clearance(
  uuid, date, integer, integer, integer, integer, integer, jsonb, text
) to authenticated, service_role;
