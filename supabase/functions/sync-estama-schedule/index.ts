import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EstamaShift {
  castName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  room?: string;
  castType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Estama schedule sync...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // エステ魂のスケジュールページを取得（次の7日間分）
    const shifts: EstamaShift[] = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      // 日付ごとにページを取得
      const estamaUrl = `https://estama.jp/shop/43923/schedule/?date=${dateStr}`;
      console.log(`Fetching Estama schedule for ${dateStr} from:`, estamaUrl);
      
      try {
        const response = await fetch(estamaUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const html = await response.text();
        console.log(`HTML fetched for ${dateStr}, length:`, html.length);

        // HTMLをパースしてスケジュール情報を抽出
        const dayShifts = parseEstamaSchedule(html, dateStr);
        shifts.push(...dayShifts);
        console.log(`Parsed ${dayShifts.length} shifts for ${dateStr}`);
        
        // レート制限を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error fetching schedule for ${dateStr}:`, error);
      }
    }
    
    console.log('Total parsed shifts:', shifts.length);

    // 既存のキャストを取得
    const { data: casts, error: castsError } = await supabase
      .from('casts')
      .select('id, name');

    if (castsError) {
      console.error('Error fetching casts:', castsError);
      throw castsError;
    }

    const castMap = new Map(casts.map(cast => [cast.name, cast.id]));
    console.log('Found casts:', castMap.size);

    // キャストのタイプ情報を更新
    const castTypeUpdates = new Map<string, string>();
    for (const shift of shifts) {
      if (shift.castType && castMap.has(shift.castName)) {
        castTypeUpdates.set(shift.castName, shift.castType);
      }
    }

    // キャストタイプを更新
    for (const [castName, castType] of castTypeUpdates.entries()) {
      const castId = castMap.get(castName);
      if (castId) {
        const { error: updateError } = await supabase
          .from('casts')
          .update({ type: castType })
          .eq('id', castId);
        
        if (updateError) {
          console.error(`Error updating cast type for ${castName}:`, updateError);
        } else {
          console.log(`Updated cast type for ${castName} to ${castType}`);
        }
      }
    }

    // シフトデータを準備
    const shiftsToInsert = shifts
      .filter(shift => castMap.has(shift.castName))
      .map(shift => ({
        cast_id: castMap.get(shift.castName),
        shift_date: shift.date,
        start_time: shift.startTime,
        end_time: shift.endTime,
        status: shift.status,
        created_by: null, // 自動同期はNULL
      }));

    console.log('Shifts to insert:', shiftsToInsert.length);

    // 既存のシフトを削除（今日以降）
    const todayStr = new Date().toISOString().split('T')[0];
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .gte('shift_date', todayStr);

    if (deleteError) {
      console.error('Error deleting old shifts:', deleteError);
    }

    // 新しいシフトを挿入
    if (shiftsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(shiftsToInsert);

      if (insertError) {
        console.error('Error inserting shifts:', insertError);
        throw insertError;
      }
    }

    console.log('Sync completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        shiftsProcessed: shiftsToInsert.length,
        message: 'Schedule synced successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in sync-estama-schedule:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function parseEstamaSchedule(html: string, dateStr: string): EstamaShift[] {
  const shifts: EstamaShift[] = [];

  // Helpers inside the parser to keep scope local and avoid altering other code
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '');
  const normalizeTime = (t: string) => {
    // Accepts HH:MM, possibly >= 24 for late-night times like 26:00
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '12:00:00';
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (h >= 24) h = h - 24; // convert 26:00 -> 02:00
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  };
  const detectCastType = (context: string) => {
    // Lowercased context expected
    // Try to align with Estama labels as much as possible
    if (/(新人|new face|newbie|入店|初日|体験)/i.test(context)) return 'newbie';
    if (/(本指名|regular)/i.test(context)) return 'regular';
    if (/(姫|プリンセス|premium|vip)/i.test(context)) return 'premium';
    if (/(ランクアップ|rank\s*up)/i.test(context)) return 'rankup';
    return 'therapist';
  };

  try {
    const sectionRe = /<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4[^>]*>|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = sectionRe.exec(html)) !== null) {
      try {
        const nameHtml = match[1] || '';
        let sectionHtml = match[2] || '';

        const fullText = stripTags(nameHtml).trim();
        const castName = fullText.replace(/\(\d+\)/g, '').trim(); // remove age like (22)
        if (!castName || castName.length < 2) continue;

        const context = (nameHtml + ' ' + sectionHtml).toLowerCase();
        const castType = detectCastType(context);

        // Extract times in the section after the name
        let timeMatches = [...sectionHtml.matchAll(/(\d{1,2}:\d{2})/g)].map(m => m[1]);

        // Fallback: if not found, search a wider window after the <h4> occurrence
        if (timeMatches.length < 1) {
          const windowStart = match.index ?? 0;
          const windowEnd = Math.min(html.length, windowStart + 4000);
          const altContext = html.slice(windowStart, windowEnd);
          timeMatches = [...altContext.matchAll(/(\d{1,2}:\d{2})/g)].map(m => m[1]);
        }

        const hasAvailable = /[○◯]/.test(sectionHtml);

        if (timeMatches.length >= 2) {
          shifts.push({
            castName,
            date: dateStr,
            startTime: normalizeTime(timeMatches[0]),
            endTime: normalizeTime(timeMatches[1]),
            status: 'scheduled',
            room: undefined,
            castType,
          });
          console.log(`Added shift for ${castName}: ${timeMatches[0]} - ${timeMatches[1]}`);
        } else if (timeMatches.length === 1) {
          shifts.push({
            castName,
            date: dateStr,
            startTime: normalizeTime(timeMatches[0]),
            endTime: normalizeTime('26:00'), // default to late-night end
            status: 'scheduled',
            room: undefined,
            castType,
          });
          console.log(`Added shift for ${castName}: ${timeMatches[0]} - 26:00`);
        } else if (hasAvailable) {
          shifts.push({
            castName,
            date: dateStr,
            startTime: normalizeTime('12:00'),
            endTime: normalizeTime('26:00'),
            status: 'scheduled',
            room: undefined,
            castType,
          });
          console.log(`Added shift for ${castName}: 12:00 - 26:00 (available)`);
        }
      } catch (rowError) {
        console.error('Error parsing cast section:', rowError);
        continue;
      }
    }

    console.log(`Parsed ${shifts.length} shifts from HTML`);
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }

  return shifts;
}
