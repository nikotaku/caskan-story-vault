import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SCHEDULE_BASE_URL = 'https://zenryoku-esthe.com/schedule';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days || 7;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 既存のキャストを取得
    const { data: casts, error: castsError } = await supabase
      .from('casts')
      .select('id, name');
    if (castsError) throw castsError;

    const castMap = new Map(casts.map((c: { id: string; name: string }) => [c.name, c.id]));
    console.log(`Found ${castMap.size} casts in DB`);

    interface ShiftEntry {
      cast_id: string;
      shift_date: string;
      start_time: string;
      end_time: string;
      status: string;
      room: string | null;
      notes: string | null;
    }

    const allShifts: ShiftEntry[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];
      const url = `${SCHEDULE_BASE_URL}?day=${dateStr}&from=${dateStr}`;

      console.log(`Fetching: ${url}`);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const html = await response.text();
        const shifts = parseSchedulePage(html, dateStr, castMap);
        allShifts.push(...shifts);
        console.log(`${dateStr}: ${shifts.length} shifts found`);
      } catch (err) {
        console.error(`Error fetching ${dateStr}:`, err);
      }

      // Rate limit
      if (i < days - 1) await new Promise(r => setTimeout(r, 800));
    }

    // 今日以降の既存シフトを削除して入れ替え
    const todayStr = now.toISOString().split('T')[0];
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .gte('shift_date', todayStr);
    if (deleteError) console.error('Delete error:', deleteError);

    let inserted = 0;
    if (allShifts.length > 0) {
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(allShifts);
      if (insertError) throw insertError;
      inserted = allShifts.length;
    }

    console.log(`Sync complete: ${inserted} shifts inserted`);

    return new Response(
      JSON.stringify({ success: true, shiftsProcessed: inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function parseSchedulePage(
  html: string,
  dateStr: string,
  castMap: Map<string, string>
): Array<{
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  room: string | null;
  notes: string | null;
}> {
  const results: Array<{
    cast_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    status: string;
    room: string | null;
    notes: string | null;
  }> = [];

  // Simple approach: find all therapist-datas-each sections by splitting HTML
  const sections = html.split(/class="therapist-datas-each\b/);
  console.log(`Found ${sections.length - 1} therapist sections`);

  for (let i = 1; i < sections.length; i++) {
    const block = sections[i];

    // Extract name
    const nameMatch = block.match(/class="therapist-datas-name"[^>]*>([^<]+)</);
    if (!nameMatch) {
      // Try alt attribute from image
      const altMatch = block.match(/alt="([^"]+)"[^>]*class="therapist-data-each-tmb/);
      if (!altMatch) { console.log(`No name in section ${i}`); continue; }
      var name = altMatch[1].trim();
    } else {
      var name = nameMatch[1].trim();
    }

    const castId = castMap.get(name);
    if (!castId) {
      console.log(`Unknown cast: ${name}, skipping`);
      continue;
    }

    // Extract shift time
    const shiftMatch = block.match(/class="therapist-datas-shift"[^>]*>([\s\S]*?)<\/div>/);
    if (!shiftMatch) { console.log(`No shift time for ${name}`); continue; }
    const shiftText = shiftMatch[1].replace(/<[^>]*>/g, '').trim();
    const timeMatch = shiftText.match(/(\d{1,2}:\d{2})\s*[〜~\-－]\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) { console.log(`Cannot parse time for ${name}: ${shiftText}`); continue; }

    const startTime = normalizeTime(timeMatch[1]);
    const endTime = normalizeTime(timeMatch[2]);

    // Extract room
    const roomMatch = block.match(/class="therapist-datas-room"[^>]*>([\s\S]*?)<\/div>/);
    const room = roomMatch
      ? roomMatch[1].replace(/<[^>]*>/g, '').trim().replace(/^■|■$/g, '')
      : null;

    // Status
    const statusMatch = block.match(/class="btn-reserve-full[^"]*"[^>]*>([^<]+)</);
    const areaInfoMatch = block.match(/class="therapist-datas-area-info"[^>]*>([^<]+)</);
    const status = 'scheduled'; // DB constraint only allows: scheduled, completed, cancelled
    const statusText = statusMatch?.[1]?.trim() || areaInfoMatch?.[1]?.trim() || '';

    results.push({
      cast_id: castId,
      shift_date: dateStr,
      start_time: startTime,
      end_time: endTime,
      status,
      room: room || null,
      notes: statusText || null,
    });

    console.log(`Parsed shift: ${name} ${startTime}-${endTime} ${room || ''}`);
  }

  return results;
}

function normalizeTime(t: string): string {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '12:00:00';
  let h = parseInt(m[1], 10);
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}
