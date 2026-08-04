import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toExtTime } from "./timeFormat";
import type { ClearanceExtraItem } from "./clearanceExtraItems";

export interface ReceiptReservation {
  start_time: string;
  customer_name: string;
  course_name: string;
  price: number;
  totalBack: number;
}

export interface ClearanceReceiptData {
  date: Date;
  castName: string;
  cashTotal: number;
  reservations: ReceiptReservation[];
  totalSales: number;
  therapistBack: number;
  miscExpenses: number;
  accommodationFee: number;
  transportationFee: number;
  deductionItems: ClearanceExtraItem[];
  salaryAdjustmentItems: ClearanceExtraItem[];
  salary: number;
  payout: number;
  payoutMethod: string;
}

const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const yen = (v: number) => `¥${v.toLocaleString()}`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// 精算フローの各ステップ高さ
function stepH(subLines: number): number {
  return Math.max(24 + subLines * 22 + 16, 82);
}

/**
 * 清算明細をPNG画像として生成しダウンロードする。
 * セラピストへLINE/SMS等で送付しやすいレシート形式。
 */
export function downloadClearanceReceipt(data: ClearanceReceiptData): void {
  const scale = 2;
  const W = 600;
  const pad = 28;
  const contentW = W - pad * 2;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;
  mctx.font = `13px ${FONT}`;
  const methodLines = data.payoutMethod.trim()
    ? wrapText(mctx, data.payoutMethod.trim(), contentW)
    : [];
  const deductionItems = data.deductionItems.filter((item) => item.amount > 0);
  const salaryAdjustmentItems = data.salaryAdjustmentItems.filter((item) => item.amount > 0);
  const summaryRowCount = 5
    + (data.transportationFee > 0 ? 1 : 0)
    + deductionItems.length
    + salaryAdjustmentItems.length;

  // 高さ計算
  let H = pad;
  H += 32; // タイトル
  H += 22; // 日付
  H += 32; // セラピスト名
  H += 20; // 区切り
  H += 24; // テーブルヘッダ
  H += data.reservations.length * 46; // 予約行
  H += 16; // 区切り
  H += summaryRowCount * 26;
  H += 12; // 区切り
  H += 16 + 3 * 32 + 8; // ❶現金預かり・❷店落ち・❸投函（3行）
  if (methodLines.length > 0) {
    H += 16 + 20 + methodLines.length * 20;
  }
  // 精算フロー
  H += 24; // gap
  H += 16; // 区切り線
  H += 54; // ヘッダーバナー(40) + gap(14)
  H += stepH(3) + 8; // ❶ 封筒（3サブ行）
  H += stepH(1) + 8; // ❷ 金庫（1サブ行）
  H += stepH(1) + 8; // ❸ ポータル（1サブ行）
  H += 8 + 26 + 32;  // クロージングメッセージ
  H += 36; // フッター
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
  const flowColor = "#0f766e";

  const right = W - pad;
  let y = pad;

  // タイトル
  ctx.fillStyle = ink;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("清算明細書", pad, y + 22);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = muted;
  ctx.textAlign = "right";
  ctx.fillText(format(data.date, "yyyy年M月d日(E)", { locale: ja }), right, y + 20);
  y += 32;
  ctx.textAlign = "left";
  y += 22;

  // セラピスト名
  ctx.fillStyle = ink;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText(`${data.castName} 様`, pad, y + 18);
  y += 32;

  // 区切り
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y + 8);
  ctx.lineTo(right, y + 8);
  ctx.stroke();
  y += 20;

  // テーブルヘッダ
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = muted;
  ctx.textAlign = "left";
  ctx.fillText("予約内容", pad, y + 16);
  ctx.textAlign = "right";
  ctx.fillText("料金 / バック", right, y + 16);
  ctx.textAlign = "left";
  y += 24;

  // 予約行
  for (const r of data.reservations) {
    ctx.fillStyle = ink;
    ctx.font = `bold 13px ${FONT}`;
    const timeStr = toExtTime(r.start_time);
    ctx.fillText(timeStr, pad, y + 16);
    const timeW = ctx.measureText(timeStr).width;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(r.customer_name, pad + timeW + 10, y + 16);
    ctx.fillStyle = muted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(r.course_name, pad, y + 34);
    ctx.fillStyle = ink;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(yen(r.price), right, y + 16);
    ctx.fillStyle = muted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`バック ${yen(r.totalBack)}`, right, y + 34);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.moveTo(pad, y + 44);
    ctx.lineTo(right, y + 44);
    ctx.stroke();
    y += 46;
  }

  // 集計区切り
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(pad, y + 8);
  ctx.lineTo(right, y + 8);
  ctx.stroke();
  y += 16;

  const summaryRow = (label: string, value: string, opts?: { color?: string; bold?: boolean }) => {
    ctx.font = `${opts?.bold ? "bold " : ""}14px ${FONT}`;
    ctx.fillStyle = opts?.color ?? ink;
    ctx.textAlign = "left";
    ctx.fillText(label, pad, y + 18);
    ctx.textAlign = "right";
    ctx.fillText(value, right, y + 18);
    ctx.textAlign = "left";
    y += 26;
  };

  summaryRow("売上合計", yen(data.totalSales));
  summaryRow("給与バック", yen(data.therapistBack));
  summaryRow("雑費", `- ${yen(data.miscExpenses)}`);
  summaryRow("宿泊費", `- ${yen(data.accommodationFee)}`);
  if (data.transportationFee > 0) {
    summaryRow("交通費", `+ ${yen(data.transportationFee)}`);
  }
  for (const item of deductionItems) {
    summaryRow(item.label || "その他控除", `- ${yen(item.amount)}`);
  }
  for (const item of salaryAdjustmentItems) {
    summaryRow(item.label || "給与不足分", `+ ${yen(item.amount)}`, { color: "#047857" });
  }
  summaryRow("セラピスト給与", yen(data.salary), { color: primary, bold: true });

  // ❶❷❸ 3行サマリー
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(pad, y + 6);
  ctx.lineTo(right, y + 6);
  ctx.stroke();
  y += 16;

  const payoutRow = (num: string, label: string, value: number, opts?: { highlight?: boolean }) => {
    const rh = 32;
    if (opts?.highlight) {
      ctx.fillStyle = "#eff6ff";
      ctx.fillRect(pad, y, contentW, rh);
    }
    ctx.fillStyle = muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(num, pad + 6, y + 21);
    ctx.fillStyle = opts?.highlight ? ink : ink;
    ctx.font = opts?.highlight ? `bold 14px ${FONT}` : `13px ${FONT}`;
    ctx.fillText(label, pad + 24, y + 21);
    ctx.fillStyle = opts?.highlight ? primary : ink;
    ctx.font = opts?.highlight ? `bold 17px ${FONT}` : `bold 14px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(yen(value), right - 8, y + 22);
    ctx.textAlign = "left";
    y += rh;
  };

  // 投函金額 = 現金預かり額 − セラピスト給与
  const cashPayout = data.cashTotal - data.salary;
  payoutRow("❶", "現金預かり額", data.cashTotal);
  payoutRow("❷", "セラピスト給与", data.salary);
  payoutRow("❸", "投函金額", cashPayout, { highlight: true });
  y += 8;

  // 投函方法
  if (methodLines.length > 0) {
    y += 16;
    ctx.fillStyle = muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText("投函方法・アナウンス", pad, y + 14);
    y += 20;
    ctx.fillStyle = ink;
    ctx.font = `13px ${FONT}`;
    for (const ln of methodLines) {
      ctx.fillText(ln, pad, y + 14);
      y += 20;
    }
  }

  // ===== 精算フロー セクション =====
  y += 24;

  // 区切り線
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  y += 16;

  // ヘッダーバナー
  ctx.fillStyle = flowColor;
  roundRect(ctx, pad, y, contentW, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("精　算　フ　ロ　ー", W / 2, y + 28);
  ctx.textAlign = "left";
  y += 54;

  // ステップ描画（クロージャで y を更新）
  const drawStep = (
    num: string,
    title: string,
    subLines: string[],
    drawIllust: (cx: number, cy: number) => void
  ) => {
    const sh = stepH(subLines.length);
    const iconAreaW = 72;

    // 背景カード
    ctx.fillStyle = "#f0fdf4";
    roundRect(ctx, pad, y, contentW, sh, 7);
    ctx.fill();
    ctx.strokeStyle = "#bbf7d0";
    ctx.lineWidth = 1;
    roundRect(ctx, pad, y, contentW, sh, 7);
    ctx.stroke();

    // ステップ番号バッジ（丸）
    ctx.fillStyle = flowColor;
    ctx.beginPath();
    ctx.arc(pad + 20, y + 22, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(num, pad + 20, y + 27);
    ctx.textAlign = "left";

    // タイトル
    ctx.fillStyle = "#064e3b";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(title, pad + 44, y + 27);

    // サブ行
    ctx.fillStyle = "#374151";
    ctx.font = `13px ${FONT}`;
    for (let i = 0; i < subLines.length; i++) {
      ctx.fillText(subLines[i], pad + 46, y + 27 + 22 * (i + 1));
    }

    // イラスト（右側）
    const illCx = right - iconAreaW / 2;
    const illCy = y + sh / 2;
    drawIllust(illCx, illCy);

    y += sh + 8;
  };

  // ❶ 封筒
  drawStep("❶", "封筒に記載する", ["・源氏名", "・日付", "・金額"], (cx, cy) => {
    const ew = 54, eh = 38;
    const ex = cx - ew / 2, ey = cy - eh / 2;
    ctx.fillStyle = "#dbeafe";
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(ex, ey, ew, eh);
    ctx.fill();
    ctx.stroke();
    // 上部フラップ
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(ex + ew, ey);
    ctx.strokeStyle = "#1d4ed8";
    ctx.stroke();
    // 下部V
    ctx.beginPath();
    ctx.moveTo(ex, ey + eh);
    ctx.lineTo(cx, cy + 4);
    ctx.moveTo(ex + ew, ey + eh);
    ctx.lineTo(cx, cy + 4);
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 1;
    ctx.stroke();
    // ラベル
    ctx.fillStyle = "#1e40af";
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("封筒", cx, ey - 4);
    ctx.textAlign = "left";
  });

  // ❷ 金庫
  drawStep("❷", "金庫に投函する", ["※必ず動画を撮る事"], (cx, cy) => {
    const sw = 46, sh2 = 40;
    const sx = cx - sw / 2, sy = cy - sh2 / 2;
    // 本体
    ctx.fillStyle = "#d1d5db";
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh2);
    ctx.fill();
    ctx.stroke();
    // 投函スロット
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.rect(sx + 4, sy + 7, sw - 8, 4);
    ctx.fill();
    // ダイヤル
    ctx.fillStyle = "#6b7280";
    ctx.beginPath();
    ctx.arc(sx + 16, cy + 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(sx + 16, cy + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // ダイヤル中心点
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.arc(sx + 16, cy + 3, 2, 0, Math.PI * 2);
    ctx.fill();
    // ハンドル
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.rect(sx + sw - 12, cy - 7, 7, 14);
    ctx.fill();
    // "動画" テキスト
    ctx.fillStyle = "#dc2626";
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("動画必須", cx, sy - 4);
    ctx.textAlign = "left";
  });

  // ❸ セラピストポータル
  drawStep("❸", "セラピストポータルより報告", ["投函報告 & 清掃チェック記載"], (cx, cy) => {
    const pw = 30, ph = 48;
    const px = cx - pw / 2, py = cy - ph / 2;
    // スマートフォン本体
    ctx.fillStyle = "#ede9fe";
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 5);
    ctx.fill();
    roundRect(ctx, px, py, pw, ph, 5);
    ctx.stroke();
    // 画面
    ctx.fillStyle = "#ddd6fe";
    ctx.beginPath();
    ctx.rect(px + 3, py + 5, pw - 6, ph - 16);
    ctx.fill();
    // 画面内テキスト行
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lx2 = px + 6;
    ctx.moveTo(lx2, py + 12); ctx.lineTo(px + pw - 4, py + 12);
    ctx.moveTo(lx2, py + 18); ctx.lineTo(px + pw - 4, py + 18);
    ctx.moveTo(lx2, py + 24); ctx.lineTo(px + pw - 8, py + 24);
    ctx.stroke();
    // チェックマーク（完了感）
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx2 + 1, py + 31); ctx.lineTo(lx2 + 5, py + 36); ctx.lineTo(lx2 + 13, py + 27);
    ctx.stroke();
    // ホームボタン
    ctx.fillStyle = "#a78bfa";
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, py + ph - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ラベル
    ctx.fillStyle = "#5b21b6";
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("ポータル", cx, py - 4);
    ctx.textAlign = "left";
  });

  // クロージングメッセージ
  y += 8;
  ctx.fillStyle = flowColor;
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("以上になります！", W / 2, y + 18);
  y += 26;
  ctx.fillStyle = ink;
  ctx.font = `14px ${FONT}`;
  ctx.fillText("退出時にご報告をお願い致します 🙇", W / 2, y + 16);
  ctx.textAlign = "left";
  y += 32;

  // フッター
  y += 16;
  ctx.fillStyle = muted;
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`発行日時 ${format(new Date(), "yyyy/MM/dd HH:mm")}`, right, y + 12);
  ctx.textAlign = "left";

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const fileName = `清算明細_${data.castName}_${format(data.date, "yyyyMMdd")}.png`;

    // iOS/Android: Web Share API でファイルを直接共有（blob URL が飛ばないようにする）
    if (typeof navigator.canShare === "function") {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `清算明細 ${data.castName}` });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // キャンセル
        }
      }
    }

    // フォールバック: 通常ダウンロード（PC等）
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
