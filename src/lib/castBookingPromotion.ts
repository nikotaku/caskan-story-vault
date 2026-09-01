export const KAYAMA_NOA_BOOKING_PROMOTION = {
  title: "【香山のあ限定】",
  benefits: [
    "事前予約で20分サービス",
    "さらに次回の予約を取ると5,000円分相当のオプション無料券が付いてくる！",
  ],
} as const;

const KAYAMA_NOA_CAST_ID = "99ac7570-53ff-4366-9347-b7332837dd88";

export const hasKayamaNoaBookingPromotion = (castId?: string | null) =>
  castId === KAYAMA_NOA_CAST_ID;
