// メールアドレスの厳密な形式チェック。
// 「example,jp」（ドットではなくカンマ）や全角文字、ドットなしドメインなど、
// 実在し得ない形式を保存前に弾くための共通バリデータ。

// ローカル部: 英数字と一般的な記号のみ。先頭・末尾・連続のドットは不可。
const LOCAL_PART_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]*[A-Za-z0-9])?$/;
// ドメインラベル: 英数字とハイフンのみ。先頭・末尾のハイフンは不可。
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
// トップレベルドメイン: 2文字以上の英字（例: jp / com / tokyo）
const TLD_PATTERN = /^[A-Za-z]{2,}$/;

export const isValidEmail = (value: string): boolean => {
  const email = value.trim();
  if (!email || email.length > 255) return false;
  // 全角文字・空白・カンマなど、半角ASCII以外が混ざっていたら即NG
  if (!/^[\x21-\x7e]+$/.test(email)) return false;
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== email.indexOf("@") || atIndex === email.length - 1) return false;
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.length > 64 || domain.length > 253) return false;
  if (localPart.includes("..") || !LOCAL_PART_PATTERN.test(localPart)) return false;
  // ドメインはドット区切りで、最後のラベル（TLD）が必要
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((label) => !label || label.length > 63 || !DOMAIN_LABEL_PATTERN.test(label))) return false;
  const tld = labels[labels.length - 1];
  return TLD_PATTERN.test(tld);
};
