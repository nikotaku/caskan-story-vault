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
        created_by: '00000000-0000-0000-0000-000000000000', // システムユーザー
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
  
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      console.error('Failed to parse HTML');
      return shifts;
    }
    
    // セラピストの勤務情報を含むセクションを探す
    // エステ魂のHTMLではセラピスト情報がh4タグで表示される
    const nameElements = doc.querySelectorAll('h4');
    console.log(`Found ${nameElements.length} h4 elements`);
    
    for (const nameElement of nameElements) {
      try {
        const fullText = nameElement.textContent?.trim() || '';
        // 年齢を除去してセラピスト名を取得
        const castName = fullText.replace(/\(\d+\)/g, '').trim();
        if (!castName || castName.length < 2) continue;
        
        console.log(`Processing cast: ${castName}`);
        
        // デフォルトのタイプ
        let castType = 'therapist'; // デフォルトをtherapistに変更
        
        // セラピストのタイプを親要素から判定
        // HTMLを文字列として検索
        const htmlStr = html.toLowerCase();
        const castSection = htmlStr.indexOf(castName.toLowerCase());
        
        if (castSection >= 0) {
          // セラピスト名の周辺1000文字を取得して判定
          const contextStart = Math.max(0, castSection - 500);
          const contextEnd = Math.min(htmlStr.length, castSection + 500);
          const context = htmlStr.substring(contextStart, contextEnd);
          
          // バッジやラベルから判定
          if (context.includes('新人') || context.includes('new')) {
            castType = 'newbie';
          } else if (context.includes('本指名') || context.includes('regular')) {
            castType = 'regular';
          } else if (context.includes('姫') || context.includes('premium')) {
            castType = 'premium';
          } else if (context.includes('ランクアップ')) {
            castType = 'rankup';
          }
        }
        
        // シフト情報を探す（時間表示を検索）
        // h4タグの後の要素から時間情報を探す
        const timePattern = /(\d{1,2}:\d{2})/g;
        const siblingText = nameElement.textContent + ' ' + (nameElement.nextSibling?.textContent || '');
        const timeMatches = siblingText.match(timePattern);
        
        // ○マークの確認
        const hasAvailable = siblingText.includes('○');
        
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
          console.log(`Added shift for ${castName}: ${timeMatches[0]} - ${timeMatches[1]}`);
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
          console.log(`Added shift for ${castName}: ${timeMatches[0]} - 26:00`);
        } else if (hasAvailable) {
          shifts.push({
            castName: castName,
            date: dateStr,
            startTime: '12:00',
            endTime: '26:00',
            status: 'scheduled',
            room: null,
            castType: castType
          });
          console.log(`Added shift for ${castName}: 12:00 - 26:00 (available)`);
        }
      } catch (rowError) {
        console.error('Error parsing cast:', rowError);
        continue;
      }
    }
    
    console.log(`Parsed ${shifts.length} shifts from HTML`);
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return shifts;
}
