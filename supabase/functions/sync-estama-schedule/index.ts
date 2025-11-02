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
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
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

    // シフトデータを準備
    const shiftsToInsert = shifts
      .filter(shift => castMap.has(shift.castName))
      .map(shift => ({
        cast_id: castMap.get(shift.castName),
        shift_date: shift.date,
        start_time: shift.startTime,
        end_time: shift.endTime,
        status: shift.status,
        created_by: '00000000-0000-0000-0000-000000000000', // システムユーザー
      }));

    console.log('Shifts to insert:', shiftsToInsert.length);

    // 既存のシフトを削除（今日以降）
    const today = new Date().toISOString().split('T')[0];
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .gte('shift_date', today);

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
  
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      console.error('Failed to parse HTML');
      return shifts;
    }
    
    // セラピストの勤務情報を含むテーブル行を探す
    // エステ魂のHTMLではセラピスト情報がテーブル形式で表示される
    const rows = doc.querySelectorAll('tr');
    
    for (const row of rows) {
      try {
        // セラピスト名を探す（h4タグまたは特定のクラス）
        const nameElement = row.querySelector('h4');
        if (!nameElement) continue;
        
        const castName = nameElement.textContent?.trim().replace(/\(\d+\)/g, '').trim();
        if (!castName) continue;
        
        // 時間情報を探す（○マークや時間表示のあるセル）
        const timeCell = row.querySelector('td:last-child');
        if (!timeCell) continue;
        
        const timeText = timeCell.textContent?.trim();
        
        // 時間のパターンをマッチング (例: "12:00", "24:30")
        const timeMatches = timeText?.match(/(\d{1,2}):(\d{2})/g);
        
        if (timeMatches && timeMatches.length >= 2) {
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: timeMatches[0],
            endTime: timeMatches[1],
            status: 'scheduled',
            room: null
          });
        } else if (timeMatches && timeMatches.length === 1) {
          // 終了時間が明示されていない場合は、標準的な勤務時間を仮定
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: timeMatches[0],
            endTime: '26:00', // デフォルトの終了時間
            status: 'scheduled',
            room: null
          });
        } else if (timeText?.includes('○')) {
          // ○マークがある場合は予約可能
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: '12:00', // デフォルトの開始時間
            endTime: '26:00',
            status: 'scheduled',
            room: null
          });
        }
      } catch (rowError) {
        console.error('Error parsing row:', rowError);
        continue;
      }
    }
    
    console.log(`Parsed ${shifts.length} shifts from HTML`);
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return shifts;
}
