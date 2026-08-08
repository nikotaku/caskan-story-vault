alter table public.referral_fee_adjustments
  drop constraint if exists referral_fee_adjustments_amount_check;

alter table public.referral_fee_adjustments
  add constraint referral_fee_adjustments_amount_check check (amount <> 0);

comment on column public.referral_fee_adjustments.amount is
  'Signed adjustment in yen. Positive amounts add carryover payments; negative amounts subtract offsets.';
