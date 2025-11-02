import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // エステ魂のスケジュールページを取得
    const estamaUrl = 'https://estama.jp/shop/43923/schedule/';
    console.log('Fetching Estama schedule from:', estamaUrl);
    
    const response = await fetch(estamaUrl);
    const html = await response.text();
    
    console.log('HTML fetched, length:', html.length);

    // HTMLをパースしてスケジュール情報を抽出
    const shifts: EstamaShift[] = parseEstamaSchedule(html);
    console.log('Parsed shifts:', shifts.length);

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

function parseEstamaSchedule(html: string): EstamaShift[] {
  const shifts: EstamaShift[] = [];
  
  try {
    // 簡易的なHTMLパース（実際のHTMLの構造に合わせて調整が必要）
    // セラピスト名のパターンを探す
    const namePattern = /####\s+([^\n(]+)/g;
    // 時間のパターンを探す
    const timePattern = /(\d{2}:\d{2})/g;
    // 日付のパターンを探す
    const datePattern = /(\d{1,2})\/(\d{1,2})/g;
    
    const names = [...html.matchAll(namePattern)].map(m => m[1].trim());
    const times = [...html.matchAll(timePattern)].map(m => m[1]);
    
    console.log('Found names:', names);
    console.log('Found times:', times);
    
    // 簡易的なマッピング（実際のデータ構造に応じて改善が必要）
    for (let i = 0; i < names.length && i < times.length / 2; i++) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      shifts.push({
        castName: names[i],
        date: dateStr,
        startTime: times[i * 2] || '12:00',
        endTime: times[i * 2 + 1] || '26:00',
        status: 'scheduled'
      });
    }
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return shifts;
}
