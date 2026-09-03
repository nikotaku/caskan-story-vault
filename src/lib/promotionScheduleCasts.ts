export type PromotionCastRecord = {
  id: string;
  store_id: string;
  name: string;
  photo: string | null;
  profile: string | null;
  message: string | null;
  tags: string[];
  x_account: string | null;
  o2_url: string | null;
};

export type PromotionCastOption = Omit<PromotionCastRecord, "store_id"> & {
  linkedCastIds: string[];
};

/**
 * Keep promotion targets inside the selected store and collapse accidental
 * duplicate records for the same therapist into one selectable option.
 */
export const buildPromotionCastOptions = (
  casts: PromotionCastRecord[],
  storeId: string,
): PromotionCastOption[] => {
  const uniqueCasts = new Map<string, PromotionCastOption>();

  for (const cast of casts) {
    if (cast.store_id !== storeId) continue;

    const { store_id: _storeId, ...castWithoutStore } = cast;
    const existing = uniqueCasts.get(cast.name);
    if (existing) {
      existing.linkedCastIds.push(cast.id);
    } else {
      uniqueCasts.set(cast.name, {
        ...castWithoutStore,
        linkedCastIds: [cast.id],
      });
    }
  }

  return [...uniqueCasts.values()];
};
