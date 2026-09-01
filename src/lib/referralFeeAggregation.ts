export const AUGUST_2026_MONTH_START = "2026-08-01";
export const THIRD_SB_RULE_NAME = "3rd SB";

export interface ReferralFeeCast {
  id: string;
  name: string;
  real_name: string | null;
  store_id: string;
  referral_reward_id: string | null;
}

export interface ReferralFeeReward {
  id: string;
  name: string;
  amount: number | null;
  store_id: string;
}

export interface ReferralFeeReservation {
  cast_id: string | null;
  price: number | null;
  payment_fee: number | null;
  status: string | null;
  store_id: string;
}

export interface ReferralFeeRow {
  castId: string;
  castName: string;
  ruleName: string;
  unitAmount: number;
  count: number;
  sales: number;
  fee: number;
}

interface AggregateReferralFeesOptions {
  currentStoreId: string;
  legacyStoreId?: string;
  legacyRuleName?: string;
}

const normalizedRealName = (value: string | null) => value?.trim() || null;

export function shouldIncludeAugustLegacy3rdSb(
  storeId: string,
  monthStart: string,
  enkaStoreId: string,
) {
  return storeId === enkaStoreId && monthStart === AUGUST_2026_MONTH_START;
}

export function aggregateReferralFees(
  casts: ReferralFeeCast[],
  rewards: ReferralFeeReward[],
  reservations: ReferralFeeReservation[],
  options: AggregateReferralFeesOptions,
): ReferralFeeRow[] {
  const rewardMap = new Map(
    rewards.map((reward) => [
      reward.id,
      { name: reward.name, amount: reward.amount ?? 0 },
    ]),
  );

  // 同一人物が旧名・新名の両方に存在する場合は、現在店舗の表示名へまとめる。
  const currentCastByIdentity = new Map<string, { id: string; name: string }>();
  for (const cast of casts) {
    if (cast.store_id !== options.currentStoreId || !cast.referral_reward_id) continue;
    const reward = rewardMap.get(cast.referral_reward_id);
    const realName = normalizedRealName(cast.real_name);
    if (!reward || !realName) continue;
    currentCastByIdentity.set(`${realName}\u0000${reward.name}`, {
      id: cast.id,
      name: `${cast.name}/${realName}`,
    });
  }

  const castInfo = new Map<
    string,
    { rollupId: string; name: string; ruleName: string; unitAmount: number }
  >();
  const rollupInfo = new Map<
    string,
    { name: string; ruleName: string; unitAmount: number }
  >();

  for (const cast of casts) {
    if (!cast.referral_reward_id) continue;
    const reward = rewardMap.get(cast.referral_reward_id);
    if (!reward) continue;

    const isCurrentStore = cast.store_id === options.currentStoreId;
    const isRequestedLegacyRule = Boolean(
      options.legacyStoreId
      && cast.store_id === options.legacyStoreId
      && reward.name === options.legacyRuleName,
    );
    if (!isCurrentStore && !isRequestedLegacyRule) continue;

    const realName = normalizedRealName(cast.real_name);
    const currentIdentity = realName
      ? currentCastByIdentity.get(`${realName}\u0000${reward.name}`)
      : undefined;
    const rollupId = currentIdentity?.id ?? cast.id;
    const displayName = currentIdentity?.name
      ?? (realName ? `${cast.name}/${realName}` : cast.name);

    const info = {
      rollupId,
      name: displayName,
      ruleName: reward.name,
      unitAmount: reward.amount,
    };
    castInfo.set(cast.id, info);
    rollupInfo.set(rollupId, {
      name: displayName,
      ruleName: reward.name,
      unitAmount: reward.amount,
    });
  }

  const aggregates = new Map<string, { count: number; sales: number }>();
  for (const reservation of reservations) {
    if (reservation.status !== "completed" || !reservation.cast_id) continue;
    const info = castInfo.get(reservation.cast_id);
    if (!info) continue;

    const isCurrentStore = reservation.store_id === options.currentStoreId;
    const isRequestedLegacyRule = Boolean(
      options.legacyStoreId
      && reservation.store_id === options.legacyStoreId
      && info.ruleName === options.legacyRuleName,
    );
    if (!isCurrentStore && !isRequestedLegacyRule) continue;

    const current = aggregates.get(info.rollupId) ?? { count: 0, sales: 0 };
    current.count += 1;
    current.sales += (reservation.price ?? 0) + (reservation.payment_fee ?? 0);
    aggregates.set(info.rollupId, current);
  }

  const rows: ReferralFeeRow[] = [];
  for (const [castId, aggregate] of aggregates) {
    const info = rollupInfo.get(castId);
    if (!info || aggregate.count === 0) continue;
    rows.push({
      castId,
      castName: info.name,
      ruleName: info.ruleName,
      unitAmount: info.unitAmount,
      count: aggregate.count,
      sales: aggregate.sales,
      fee: info.unitAmount * aggregate.count,
    });
  }

  return rows.sort((a, b) => b.fee - a.fee);
}
