/**
 * Estama renders therapist panel photos at 357 x 556.
 * Keep every public therapist photo frame on the same aspect ratio so the
 * official site and Estama show the same crop.
 */
export const ESTAMA_CAST_PHOTO_WIDTH = 357;
export const ESTAMA_CAST_PHOTO_HEIGHT = 556;

export const ESTAMA_CAST_PHOTO_STYLE = {
  aspectRatio: `${ESTAMA_CAST_PHOTO_WIDTH} / ${ESTAMA_CAST_PHOTO_HEIGHT}`,
} as const;
