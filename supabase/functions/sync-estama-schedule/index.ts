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
  room?: string;
  castType?: string;
}

interface EstamaCastProfile {
  name: string;
  age?: number;
  height?: number;
  bust?: number;
  waist?: number;
  hip?: number;
  cupSize?: string;
  photo?: string;
  photos?: string[];
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const syncType = body.syncType || 'both'; // 'schedule', 'profiles', 'both'
    
    console.log(`Starting Estama sync (type: ${syncType})...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    let shiftsProcessed = 0;
    let profilesProcessed = 0;

    // === スケジュール同期 ===
    if (syncType === 'schedule' || syncType === 'both') {
      const shifts: EstamaShift[] = [];
      const now = new Date();
      
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        const estamaUrl = `https://estama.jp/shop/43923/schedule/?date=${dateStr}`;
        console.log(`Fetching Estama schedule for ${dateStr}`);
        
        try {
          const response = await fetch(estamaUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const html = await response.text();
          const dayShifts = parseEstamaSchedule(html, dateStr);
          shifts.push(...dayShifts);
          console.log(`Parsed ${dayShifts.length} shifts for ${dateStr}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching schedule for ${dateStr}:`, error);
        }
      }

      // キャストタイプ更新
      const castTypeUpdates = new Map<string, string>();
      for (const shift of shifts) {
        if (shift.castType && castMap.has(shift.castName)) {
          castTypeUpdates.set(shift.castName, shift.castType);
        }
      }
      for (const [castName, castType] of castTypeUpdates.entries()) {
        const castId = castMap.get(castName);
        if (castId) {
          await supabase.from('casts').update({ type: castType }).eq('id', castId);
        }
      }

      // 重複除去
      const uniqueShiftsMap = new Map<string, EstamaShift>();
      for (const shift of shifts) {
        if (!castMap.has(shift.castName)) continue;
        const key = `${shift.castName}-${shift.date}`;
        const existing = uniqueShiftsMap.get(key);
        if (!existing) {
          uniqueShiftsMap.set(key, shift);
        } else {
          uniqueShiftsMap.set(key, {
            ...existing,
            startTime: shift.startTime < existing.startTime ? shift.startTime : existing.startTime,
            endTime: shift.endTime > existing.endTime ? shift.endTime : existing.endTime,
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
          created_by: null,
        }));

      const todayStr = new Date().toISOString().split('T')[0];
      await supabase.from('shifts').delete().gte('shift_date', todayStr);

      if (shiftsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('shifts').insert(shiftsToInsert);
        if (insertError) throw insertError;
      }

      shiftsProcessed = shiftsToInsert.length;
      console.log(`Schedule sync done: ${shiftsProcessed} shifts`);
    }

    // === セラピストプロフィール同期 ===
    if (syncType === 'profiles' || syncType === 'both') {
      try {
        const castListUrl = 'https://estama.jp/shop/43923/cast/';
        console.log('Fetching Estama cast list...');
        
        const response = await fetch(castListUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const html = await response.text();
        const profiles = parseEstamaCastList(html);
        console.log(`Parsed ${profiles.length} profiles from cast list`);

        // 名前が一致する既存セラピストのみ更新（新規作成も行う）
        for (const profile of profiles) {
          const castId = castMap.get(profile.name);
          
          const updateData: Record<string, unknown> = {};
          if (profile.age) updateData.age = profile.age;
          if (profile.height) updateData.height = profile.height;
          if (profile.bust) updateData.bust = profile.bust;
          if (profile.waist) updateData.waist = profile.waist;
          if (profile.hip) updateData.hip = profile.hip;
          if (profile.cupSize) updateData.cup_size = profile.cupSize;
          if (profile.message) updateData.message = profile.message;
          if (profile.photos && profile.photos.length > 0) {
            // エスたまの写真URLをそのまま保存（既存の写真がない場合のみ）
            updateData.photo = profile.photos[0];
          }

          if (Object.keys(updateData).length === 0) continue;

          if (castId) {
            // 既存キャストを更新
            const { error } = await supabase
              .from('casts')
              .update(updateData)
              .eq('id', castId);
            
            if (error) {
              console.error(`Error updating profile for ${profile.name}:`, error);
            } else {
              profilesProcessed++;
              console.log(`Updated profile for ${profile.name}`);
            }
          } else {
            // 新規キャストを作成
            const { error } = await supabase
              .from('casts')
              .insert({
                name: profile.name,
                type: 'therapist',
                status: 'offline',
                ...updateData,
              });
            
            if (error) {
              console.error(`Error creating cast for ${profile.name}:`, error);
            } else {
              profilesProcessed++;
              console.log(`Created new cast: ${profile.name}`);
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Profile sync done: ${profilesProcessed} profiles`);
      } catch (error) {
        console.error('Error syncing profiles:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        shiftsProcessed,
        profilesProcessed,
        message: 'Sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in sync-estama-schedule:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
    const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/i);
    if (!theadMatch) return shifts;
    
    const theadContent = theadMatch[1];
    const thRegex = /<th[^>]*class="th_sce"[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch: RegExpExecArray | null;
    
    while ((thMatch = thRegex.exec(theadContent)) !== null) {
      try {
        const thContent = thMatch[1];
        const nameMatch = thContent.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
        if (!nameMatch) continue;
        
        const castName = stripTags(nameMatch[1]);
        if (!castName || castName.length < 2) continue;
        
        const dateMatch = thContent.match(/<div[^>]*class="item-date"[^>]*>([\s\S]*?)<\/div>/i);
        if (!dateMatch) continue;
        
        const dateContent = dateMatch[1];
        const timeSpans = [...dateContent.matchAll(/<span[^>]*>([^<]+)<\/span>/g)];
        
        if (timeSpans.length >= 3) {
          shifts.push({
            castName,
            date: dateStr,
            startTime: normalizeTime(timeSpans[0][1].trim()),
            endTime: normalizeTime(timeSpans[2][1].trim()),
            status: 'scheduled',
            castType: 'therapist',
          });
        }
      } catch (rowError) {
        console.error('Error parsing therapist block:', rowError);
      }
    }
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }

  return shifts;
}

function parseEstamaCastList(html: string): EstamaCastProfile[] {
  const profiles: EstamaCastProfile[] = [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

  try {
    // セラピストカードを抽出
    const castBlockRegex = /<div[^>]*class="[^"]*cast-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const altPattern = /<li[^>]*class="[^"]*cast[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    
    // まずcast-cardパターンを試す
    let matches = [...html.matchAll(castBlockRegex)];
    if (matches.length === 0) {
      matches = [...html.matchAll(altPattern)];
    }
    
    // より汎用的なパターン: h4 + 3サイズ情報を含むブロック
    const nameRegex = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
    const nameMatches = [...html.matchAll(nameRegex)];
    
    for (const nameMatch of nameMatches) {
      const name = stripTags(nameMatch[1]);
      if (!name || name.length < 2 || name.length > 20) continue;
      
      // 名前の前後のコンテキストからプロフィール情報を抽出
      const nameIndex = nameMatch.index || 0;
      const context = html.substring(Math.max(0, nameIndex - 500), Math.min(html.length, nameIndex + 2000));
      
      const profile: EstamaCastProfile = { name };
      
      // 年齢
      const ageMatch = context.match(/(\d{2})歳/);
      if (ageMatch) profile.age = parseInt(ageMatch[1]);
      
      // 身長
      const heightMatch = context.match(/T(\d{3})/);
      if (heightMatch) profile.height = parseInt(heightMatch[1]);
      
      // 3サイズ B-W-H
      const sizeMatch = context.match(/B(\d{2,3})\s*[\(（]([A-K])[\)）]\s*[・\/]\s*W(\d{2})\s*[・\/]\s*H(\d{2,3})/i);
      if (sizeMatch) {
        profile.bust = parseInt(sizeMatch[1]);
        profile.cupSize = sizeMatch[2];
        profile.waist = parseInt(sizeMatch[3]);
        profile.hip = parseInt(sizeMatch[4]);
      }
      
      // 写真URL
      const imgMatch = context.match(/<img[^>]*src="(https?:\/\/[^"]*estama[^"]*)"[^>]*>/i);
      if (imgMatch) {
        profile.photos = [imgMatch[1]];
      }
      
      // コメント
      const commentMatch = context.match(/<p[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      if (commentMatch) {
        profile.message = stripTags(commentMatch[1]).substring(0, 500);
      }

      // 重複チェック
      if (!profiles.find(p => p.name === name)) {
        profiles.push(profile);
      }
    }
  } catch (error) {
    console.error('Error parsing cast list:', error);
  }

  return profiles;
}
