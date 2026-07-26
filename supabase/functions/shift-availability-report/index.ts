// シフトの空き枠（出勤ゼロの日）を店舗ごとに集計し、管理用グループLINEへ定期送信する。
// pg_cron から 10日ごと（毎月1・11・21日）に呼び出される想定。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 集計対象の日数（実行日から先の日数）
const WINDOW_DAYS = 31;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const ymd = (d: Date) => {
  const j = new Date(d.getTime() + JST_OFFSET_MS);
  return j.toISOString().slice(0, 10);
};
const mmdd = (dateStr: string) => {
  const [, m, d] = dateStr.split("-");
  const dow = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${dateStr}T00:00:00+09:00`).getDay()];
  return `${Number(m)}/${Number(d)}(${dow})`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("LINE_GROUP_ID");
    if (!token || !groupId) {
      return new Response(JSON.stringify({ error: "LINE設定が未構成です" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 集計期間
    const now = new Date();
    const start = ymd(now);
    const endDate = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const end = ymd(endDate);

    // 対象店舗
    const { data: stores } = await sb.from("stores").select("id, name").order("created_at", { ascending: true });
    const storeList = (stores || []) as { id: string; name: string }[];

    const blocks: string[] = [];
    for (const st of storeList) {
      const { data: shifts } = await sb
        .from("shifts")
        .select("shift_date")
        .eq("store_id", st.id)
        .gte("shift_date", start)
        .lte("shift_date", end);

      // 日別の出勤件数
      const perDay = new Map<string, number>();
      for (const s of (shifts || []) as { shift_date: string }[]) {
        perDay.set(s.shift_date, (perDay.get(s.shift_date) ?? 0) + 1);
      }

      // 期間内の全日をなめて、出勤ゼロの日（空き）を抽出
      const empties: string[] = [];
      let workingDays = 0;
      for (let i = 0; i < WINDOW_DAYS; i++) {
        const d = ymd(new Date(now.getTime() + i * 24 * 60 * 60 * 1000));
        const cnt = perDay.get(d) ?? 0;
        if (cnt === 0) empties.push(d);
        else workingDays++;
      }

      const totalShifts = (shifts || []).length;
      const lines: string[] = [`【${st.name}】今後${WINDOW_DAYS}日`];
      lines.push(`出勤あり ${workingDays}日 / 総シフト ${totalShifts}件`);
      if (empties.length === 0) {
        lines.push("✅ 空き（出勤ゼロ）の日はありません");
      } else {
        lines.push(`⚠️ 空き（出勤ゼロ）${empties.length}日：`);
        lines.push(empties.map(mmdd).join("、"));
      }
      blocks.push(lines.join("\n"));
    }

    const message = ["🗓 シフト空き枠レポート", "", ...blocks].join("\n\n");

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: message }] }),
    });

    if (!lineRes.ok) {
      const t = await lineRes.text();
      return new Response(JSON.stringify({ error: "LINE送信失敗", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
