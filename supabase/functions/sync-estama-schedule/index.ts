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

    // シフトデータを準備（重複を除去）
    const uniqueShiftsMap = new Map<string, EstamaShift>();
    
    for (const shift of shifts) {
      if (!castMap.has(shift.castName)) continue;
      
      const key = `${shift.castName}-${shift.date}`;
      const existing = uniqueShiftsMap.get(key);
      
      if (!existing) {
        uniqueShiftsMap.set(key, shift);
      } else {
        // 複数のシフトがある場合、最も早い開始時間と最も遅い終了時間を使用
        const earlierStart = shift.startTime < existing.startTime ? shift.startTime : existing.startTime;
        const laterEnd = shift.endTime > existing.endTime ? shift.endTime : existing.endTime;
        
        uniqueShiftsMap.set(key, {
          ...existing,
          startTime: earlierStart,
          endTime: laterEnd
        });
      }
    }
    
    const shiftsToInsert = Array.from(uniqueShiftsMap.values())
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

  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
  const normalizeTime = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '12:00:00';
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (h >= 24) h = h - 24;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  };

  try {
    // テーブルのヘッダーセクションから出勤セラピスト情報を抽出
    const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/i);
    if (!theadMatch) {
      console.log('Table thead not found');
      return shifts;
    }
    
    const theadContent = theadMatch[1];
    
    // 各セラピストのthブロックを抽出
    const thRegex = /<th[^>]*class="th_sce"[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch: RegExpExecArray | null;
    
    while ((thMatch = thRegex.exec(theadContent)) !== null) {
      try {
        const thContent = thMatch[1];
        
        // h4タグからセラピスト名を取得
        const nameMatch = thContent.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
        if (!nameMatch) continue;
        
        const castName = stripTags(nameMatch[1]);
        if (!castName || castName.length < 2) continue;
        
        // item-dateから時間情報を取得
        const dateMatch = thContent.match(/<div[^>]*class="item-date"[^>]*>([\s\S]*?)<\/div>/i);
        if (!dateMatch) continue;
        
        const dateContent = dateMatch[1];
        const timeSpans = [...dateContent.matchAll(/<span[^>]*>([^<]+)<\/span>/g)];
        
        if (timeSpans.length >= 3) {
          const startTime = timeSpans[0][1].trim();
          const endTime = timeSpans[2][1].trim();
          
          shifts.push({
            castName,
            date: dateStr,
            startTime: normalizeTime(startTime),
            endTime: normalizeTime(endTime),
            status: 'scheduled',
            room: undefined,
            castType: 'therapist',
          });
          
          console.log(`Added shift for ${castName}: ${startTime} - ${endTime}`);
        }
      } catch (rowError) {
        console.error('Error parsing therapist block:', rowError);
        continue;
      }
    }

    console.log(`Parsed ${shifts.length} shifts from HTML`);
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }

  return shifts;
}
