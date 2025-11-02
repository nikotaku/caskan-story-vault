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
    const rows = doc.querySelectorAll('tr');
    
    for (const row of rows) {
      try {
        // セラピスト名を探す（h4タグまたは特定のクラス）
        const nameElement = row.querySelector('h4');
        if (!nameElement) continue;
        
        const fullText = nameElement.textContent?.trim() || '';
        const castName = fullText.replace(/\(\d+\)/g, '').trim();
        if (!castName) continue;
        
        // セラピストのタイプを判定（バッジやラベルから）
        let castType = 'standard'; // デフォルト
        const parentContainer = row.closest('div');
        
        // エステ魂のHTMLではセラピストタイプがバッジやラベルで表示される
        // 例：「新人」「本指名」「ランクアップ」など
        if (parentContainer) {
          const badges = parentContainer.querySelectorAll('.badge, span[class*="label"], span[class*="tag"]');
          for (const badge of badges) {
            const badgeText = badge.textContent?.trim().toLowerCase();
            if (badgeText?.includes('新人') || badgeText?.includes('new')) {
              castType = 'newbie';
            } else if (badgeText?.includes('本指名') || badgeText?.includes('regular')) {
              castType = 'regular';
            } else if (badgeText?.includes('姫') || badgeText?.includes('premium')) {
              castType = 'premium';
            } else if (badgeText?.includes('ランクアップ')) {
              castType = 'rankup';
            }
          }
        }
        
        // タイトルやURLからも判定を試みる
        const linkElement = row.querySelector('a[href*="/cast/"]');
        if (linkElement) {
          const href = linkElement.getAttribute('href') || '';
          // URLパターンから推測
          if (href.includes('new') || href.includes('rookie')) {
            castType = 'newbie';
          }
        }
        
        // 時間情報を探す
        const timeCell = row.querySelector('td:last-child');
        if (!timeCell) continue;
        
        const timeText = timeCell.textContent?.trim();
        const timeMatches = timeText?.match(/(\d{1,2}):(\d{2})/g);
        
        if (timeMatches && timeMatches.length >= 2) {
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: timeMatches[0],
            endTime: timeMatches[1],
            status: 'scheduled',
            room: null,
            castType: castType
          });
        } else if (timeMatches && timeMatches.length === 1) {
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: timeMatches[0],
            endTime: '26:00',
            status: 'scheduled',
            room: null,
            castType: castType
          });
        } else if (timeText?.includes('○')) {
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: '12:00',
            endTime: '26:00',
            status: 'scheduled',
            room: null,
            castType: castType
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
