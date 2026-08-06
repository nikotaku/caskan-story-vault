import { format } from "date-fns";
import { ja } from "date-fns/locale";

export interface ReferralReceiptRow {
  castName: string;
  ruleName: string;
  unitAmount: number;
  count: number;
  fee: number;
}

export interface ReferralReceiptAdjustment {
  reason: string;
  amount: number;
}

export interface ReferralReceiptData {
  month: Date;      // 対象月
  ruleLabel: string; // 紹介元ルール名（"すべて" の場合は全紹介元）
  rows: ReferralReceiptRow[];
  adjustments: ReferralReceiptAdjustment[];
}

const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const yen = (v: number) => `${v < 0 ? "−" : ""}¥${Math.abs(v).toLocaleString()}`;

/**
 * 紹介費の明細をPNG画像として生成し、共有／ダウンロードする。
 * 紹介元会社へLINE/メール等で送付しやすいレシート形式。
 */
export function downloadReferralReceipt(data: ReferralReceiptData): void {
  const scale = 2;
  const W = 620;
  const pad = 28;
  const right = W - pad;
  const rowH = 40;

  // 高さ計算
  let H = pad;
  H += 30; // タイトル
  H += 22; // 期間
  H += 20; // 区切り
  H += 26; // テーブルヘッダ
  H += (data.rows.length + data.adjustments.length) * rowH;
  H += 16; // 区切り
  H += 60; // 合計ブロック
  H += 30; // フッター
  H += pad;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = Math.ceil(H) * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const ink = "#1f2937";
  const muted = "#6b7280";
  const primary = "#2563eb";
  const line = "#e5e7eb";

  let y = pad;

  // タイトル
  ctx.fillStyle = ink;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("広告費 明細書", pad, y + 22);
  y += 30;

  // 期間
  ctx.fillStyle = muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`対象期間：${format(data.month, "yyyy年M月", { locale: ja })}`, pad, y + 16);
  y += 22;

  // 区切り
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y + 8);
  ctx.lineTo(right, y + 8);
  ctx.stroke();
  y += 20;

  // テーブルヘッダ
  const colCast = pad;
  const colCount = W - pad - 300;
  const colUnit = W - pad - 170;
  const colFee = right;
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = muted;
  ctx.fillText("セラピスト", colCast, y + 16);
  ctx.textAlign = "right";
  ctx.fillText("shot", colCount, y + 16);
  ctx.fillText("単価", colUnit, y + 16);
  ctx.fillText("広告費", colFee, y + 16);
  ctx.textAlign = "left";
  y += 26;

  // 行
  let totalCount = 0;
  let totalFee = 0;
  for (const r of data.rows) {
    totalCount += r.count;
    totalFee += r.fee;
    ctx.fillStyle = ink;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(r.castName, colCast, y + 20);
    ctx.fillStyle = ink;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${r.count}shot`, colCount, y + 20);
    ctx.fillText(yen(r.unitAmount), colUnit, y + 20);
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(yen(r.fee), colFee, y + 20);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.moveTo(pad, y + rowH - 4);
    ctx.lineTo(right, y + rowH - 4);
    ctx.stroke();
    y += rowH;
  }

  for (const adjustment of data.adjustments) {
    totalFee -= adjustment.amount;
    ctx.fillStyle = "#b91c1c";
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(`相殺：${adjustment.reason}`, colCast, y + 20, colCount - colCast - 12);
    ctx.fillStyle = muted;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("—", colCount, y + 20);
    ctx.fillText("—", colUnit, y + 20);
    ctx.fillStyle = "#dc2626";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(`−${yen(adjustment.amount)}`, colFee, y + 20);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#fee2e2";
    ctx.beginPath();
    ctx.moveTo(pad, y + rowH - 4);
    ctx.lineTo(right, y + rowH - 4);
    ctx.stroke();
    y += rowH;
  }

  // 区切り
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(pad, y + 8);
  ctx.lineTo(right, y + 8);
  ctx.stroke();
  y += 16;

  // 合計ブロック
  ctx.fillStyle = "#eff6ff";
  ctx.fillRect(pad, y, W - pad * 2, 48);
  ctx.fillStyle = muted;
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`合計 ${totalCount}shot`, pad + 12, y + 30);
  ctx.fillStyle = ink;
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("広告費合計", right - 150, y + 30);
  ctx.fillStyle = totalFee < 0 ? "#dc2626" : primary;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(yen(totalFee), right - 12, y + 32);
  ctx.textAlign = "left";
  y += 60;

  // フッター
  ctx.fillStyle = muted;
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`発行日時 ${format(new Date(), "yyyy/MM/dd HH:mm")}`, right, y + 12);
  ctx.textAlign = "left";

  const monthStr = format(data.month, "yyyyMM");
  const ruleStr = data.ruleLabel.replace(/[\\/:*?"<>|\s]/g, "");
  const fileName = `広告費明細_${ruleStr}_${monthStr}.png`;

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    if (typeof navigator.canShare === "function") {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `広告費明細 ${data.ruleLabel}` });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
