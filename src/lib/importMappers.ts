import { supabase } from "@/integrations/supabase/client";

export function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQ = false, cur = "";
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === "," && !inQ) { cols.push(cur); cur = ""; }
      else { cur += c; }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function getCol(row: string[], headers: string[], name: string) {
  return (row[headers.indexOf(name)] || "").trim();
}

function getColAny(row: string[], headers: string[], names: string[]) {
  for (const name of names) {
    const idx = headers.findIndex((h) => h.trim() === name);
    if (idx >= 0) {
      const v = (row[idx] || "").trim();
      if (v) return v;
    }
  }
  return "";
}

export function mapCustomerRows(headers: string[], dataRows: string[][]) {
  return dataRows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const phone = getCol(r, headers, "電話番号").replace(/^'/, "").replace(/[^\d]/g, "");
      if (!phone) return null;
      const ng = getCol(r, headers, "NG");
      const memo = getCol(r, headers, "メモ");
      const statusRaw = getCol(r, headers, "ステータス");
      const visitRaw = getCol(r, headers, "利用回数");
      return {
        name: getCol(r, headers, "名前") || phone,
        kana: getColAny(r, headers, ["かな", "カナ", "フリガナ", "ふりがな"]) || null,
        phone,
        email: getColAny(r, headers, ["Email", "email", "メールアドレス", "メール"]) || null,
        visit_count: visitRaw ? parseInt(visitRaw, 10) : null,
        status: statusRaw === "出禁" ? "banned" : statusRaw === "要注意" ? "caution" : "active",
        notes: [memo, ng ? `NG: ${ng}` : ""].filter(Boolean).join(" / ") || null,
      };
    })
    .filter(Boolean) as any[];
}

export function mapReservationRows(headers: string[], dataRows: string[][], castMap: Map<string, string>) {
  const parsePrice = (s: string) => parseInt(s.replace(/[¥,\s]/g, "") || "0", 10) || 0;
  const parseDur = (c: string) => { const m = c.match(/(\d+)分/); return m ? parseInt(m[1]) : 60; };
  const parseDate = (s: string) => {
    if (!s) return null;
    const str = s.trim();
    let yr: number | null = null, mo: number, d: number;
    // YYYY/M/D, YYYY-M-D, YYYY年M月D日
    let m = str.match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
    if (m) {
      yr = parseInt(m[1]); mo = parseInt(m[2]); d = parseInt(m[3]);
    } else {
      // M/D, M-D, M月D日
      m = str.match(/(\d{1,2})[\/\-月.](\d{1,2})/);
      if (!m) return null;
      mo = parseInt(m[1]); d = parseInt(m[2]);
    }
    if (!mo || !d || mo > 12 || d > 31) return null;
    // 時刻（任意）
    const tm = str.match(/(\d{1,2}):(\d{2})/);
    const h = tm ? parseInt(tm[1]) : 0;
    const mi = tm ? parseInt(tm[2]) : 0;
    if (yr === null) {
      // 年指定がない場合：10〜12月は前年、1〜9月は当年とみなす
      const curYear = new Date().getFullYear();
      yr = mo >= 10 ? curYear - 1 : curYear;
    }
    const dt = new Date(yr, mo - 1, d, h, mi);
    const dd = dt.getDate(), dm = dt.getMonth() + 1, dy = dt.getFullYear();
    return {
      date: `${dy}-${String(dm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`,
      time: `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`,
    };
  };
  const parseCast = (s: string) => {
    const name = s.trim().split(/\s+/)[0];
    if (["写真指名","本指名","講習"].includes(name)) return "";
    return name.replace(/^[？🌊🚢]+/, "");
  };
  const parseStatus = (s: string) => ({ "完了":"completed","キャンセル":"cancelled","予約確定":"confirmed","新規予約":"pending" }[s] || "pending");
  const parsePay = (s: string) => ({ "現金":"cash","カード":"card","PayPay":"paypay" }[s] || null);

  return dataRows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const d = parseDate(getColAny(r, headers, ["開始日時", "予約日時", "予約日", "日時", "日付", "来店日", "予約日付"]));
      if (!d) return null;
      const castName = parseCast(getColAny(r, headers, ["キャスト", "セラピスト", "担当", "担当者"]));
      const route = getColAny(r, headers, ["予約経路", "経路", "流入経路", "媒体"]);
      const notesBase = getColAny(r, headers, ["メモ", "備考", "コメント"]);
      const noteParts = [notesBase, route ? `経路: ${route}` : ""].filter(Boolean);
      const course = getColAny(r, headers, ["コース", "メニュー", "コース名"]);
      return {
        reservation_date: d.date,
        start_time: d.time,
        customer_name: getColAny(r, headers, ["予約名", "顧客名", "お名前", "名前", "予約者"]) || "不明",
        customer_phone: getColAny(r, headers, ["電話番号", "電話", "TEL", "tel"]).replace(/^'/, "").replace(/[^\d]/g, "") || "",
        customer_email: getColAny(r, headers, ["メールアドレス", "Email", "email", "メール"]) || null,
        cast_id: castName ? (castMap.get(castName) || null) : null,
        nomination_type: getColAny(r, headers, ["指名", "指名種別"]) || null,
        course_name: course || "不明",
        duration: parseDur(course),
        room: getColAny(r, headers, ["ルーム", "部屋", "店舗"]) || null,
        price: parsePrice(getColAny(r, headers, ["売上", "料金", "金額", "価格"])),
        payment_method: parsePay(getColAny(r, headers, ["決済方法", "決済", "支払", "支払方法"])),
        referral_source: route || null,
        status: parseStatus(getColAny(r, headers, ["ステータス", "状態", "予約状況"])),
        booking_origin: "csv_import",
        notes: noteParts.join(" / ") || null,
      };
    })
    .filter((r) => r !== null) as any[];
}

export async function batchInsert(table: string, rows: any[], onProgress?: (n: number) => void) {
  const BATCH = 50;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table as any).insert(rows.slice(i, i + BATCH));
    if (error) {
      const detail = [
        error.message,
        (error as any).code ? `Code: ${(error as any).code}` : "",
        (error as any).details ? `Details: ${(error as any).details}` : "",
        (error as any).hint ? `Hint: ${(error as any).hint}` : "",
      ].filter(Boolean).join(" | ");
      const err = new Error(detail);
      (err as any).raw = error;
      throw err;
    }
    count += Math.min(BATCH, rows.length - i);
    onProgress?.(count);
  }
  return count;
}
