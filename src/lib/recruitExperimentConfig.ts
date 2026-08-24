export const RECRUIT_EXPERIMENT_ID = "recruit_hero_v1_20260825";
export const RECRUIT_EXPERIMENT_STARTED_ON = "2026-08-25";

export const RECRUIT_VARIANTS = ["safety_first", "freedom_first"] as const;
export const RECRUIT_EVENTS = ["exposure", "cta_click"] as const;

export type RecruitVariant = (typeof RECRUIT_VARIANTS)[number];
export type RecruitEvent = (typeof RECRUIT_EVENTS)[number];

export function isRecruitVariant(value: string | null): value is RecruitVariant {
  return RECRUIT_VARIANTS.some((variant) => variant === value);
}
