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

    const estamaEmail = Deno.env.get('ESTAMA_EMAIL');
    const estamaPassword = Deno.env.get('ESTAMA_PASSWORD');

    // 既存のキャストを取得
    const { data: casts, error: castsError } = await supabase
      .from('casts')
      .select('id, name');

    if (castsError) throw castsError;

    const castMap = new Map(casts.map(cast => [cast.name, cast.id]));
    console.log('Found casts:', castMap.size);

    let shiftsProcessed = 0;
    let profilesProcessed = 0;
    let loginCookies: string | null = null;

    // === エスたま管理画面にログイン ===
    if (estamaEmail && estamaPassword) {
      loginCookies = await loginToEstama(estamaEmail, estamaPassword);
      if (loginCookies) {
        console.log('Successfully logged into Estama admin panel');
      } else {
        console.warn('Failed to login to Estama, falling back to public pages');
      }
    } else {
      console.log('No Estama credentials configured, using public pages only');
    }

    // === スケジュール同期 ===
    if (syncType === 'schedule' || syncType === 'both') {
      const shifts: EstamaShift[] = [];
      const now = new Date();
      
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        // ログイン済みなら管理画面のスケジュールページ、そうでなければ公開ページ
        const estamaUrl = loginCookies
          ? `https://estama.jp/admin/schedule/?date=${dateStr}`
          : `https://estama.jp/shop/43923/schedule/?date=${dateStr}`;
        
        console.log(`Fetching schedule for ${dateStr} from: ${estamaUrl}`);
        
        try {
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          };
          if (loginCookies) {
            headers['Cookie'] = loginCookies;
          }

          const response = await fetch(estamaUrl, { headers, redirect: 'manual' });
          
          // リダイレクトされた場合はログインが切れている
          if (response.status >= 300 && response.status < 400) {
            console.log(`Redirected for ${dateStr}, falling back to public page`);
            const publicUrl = `https://estama.jp/shop/43923/schedule/?date=${dateStr}`;
            const pubResponse = await fetch(publicUrl, {
              headers: { 'User-Agent': headers['User-Agent'] }
            });
            const html = await pubResponse.text();
            const dayShifts = parseEstamaSchedule(html, dateStr);
            shifts.push(...dayShifts);
          } else {
            const html = await response.text();
            
            if (loginCookies) {
              // 管理画面のHTMLをパース
              const dayShifts = parseAdminSchedule(html, dateStr);
              if (dayShifts.length > 0) {
                shifts.push(...dayShifts);
              } else {
                // 管理画面パースに失敗した場合、公開ページにフォールバック
                const dayShiftsFallback = parseEstamaSchedule(html, dateStr);
                shifts.push(...dayShiftsFallback);
              }
            } else {
              const dayShifts = parseEstamaSchedule(html, dateStr);
              shifts.push(...dayShifts);
            }
          }
          
          console.log(`Current total shifts: ${shifts.length}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching schedule for ${dateStr}:`, error);
        }
      }

      // キャストタイプ更新
      for (const shift of shifts) {
        if (shift.castType && castMap.has(shift.castName)) {
          const castId = castMap.get(shift.castName);
          if (castId) {
            await supabase.from('casts').update({ type: shift.castType }).eq('id', castId);
          }
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
        // ログイン済みなら管理画面のキャスト一覧を使用
        const castListUrl = loginCookies
          ? 'https://estama.jp/admin/cast/'
          : 'https://estama.jp/shop/43923/cast/';
        
        console.log(`Fetching cast list from: ${castListUrl}`);
        
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        if (loginCookies) {
          headers['Cookie'] = loginCookies;
        }

        const response = await fetch(castListUrl, { headers, redirect: 'manual' });
        
        let html: string;
        let isAdmin = false;
        
        if (response.status >= 300 && response.status < 400) {
          // リダイレクトされた場合は公開ページにフォールバック
          console.log('Admin redirect detected, falling back to public cast page');
          const pubResponse = await fetch('https://estama.jp/shop/43923/cast/', {
            headers: { 'User-Agent': headers['User-Agent'] }
          });
          html = await pubResponse.text();
        } else {
          html = await response.text();
          isAdmin = !!loginCookies;
        }

        const profiles = isAdmin
          ? parseAdminCastList(html)
          : parseEstamaCastList(html);
        
        console.log(`Parsed ${profiles.length} profiles (admin: ${isAdmin})`);

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
            updateData.photo = profile.photos[0];
          }

          if (Object.keys(updateData).length === 0 && castId) continue;

          if (castId) {
            const { error } = await supabase
              .from('casts')
              .update(updateData)
              .eq('id', castId);
            
            if (!error) {
              profilesProcessed++;
              console.log(`Updated profile for ${profile.name}`);
            } else {
              console.error(`Error updating ${profile.name}:`, error);
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
            
            if (!error) {
              profilesProcessed++;
              console.log(`Created new cast: ${profile.name}`);
            } else {
              console.error(`Error creating ${profile.name}:`, error);
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
        loggedIn: !!loginCookies,
        message: 'Sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in sync-estama-schedule:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// === エスたまログイン ===
async function loginToEstama(email: string, password: string): Promise<string | null> {
  try {
    console.log('Attempting Estama login...');
    
    // まずログインページを取得してCSRFトークンを取得
    const loginPageResponse = await fetch('https://estama.jp/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });
    
    const loginPageHtml = await loginPageResponse.text();
    const setCookieHeaders = loginPageResponse.headers.getSetCookie?.() || [];
    let cookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    
    console.log('Login page fetched, cookies:', cookies ? 'present' : 'none');
    
    // CSRFトークンを抽出
    const csrfMatch = loginPageHtml.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/i)
      || loginPageHtml.match(/name="_token"\s+value="([^"]+)"/i)
      || loginPageHtml.match(/csrf[_-]?token['"]\s*(?:content|value)=['"]([\w-]+)['"]/i);
    
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    console.log('CSRF token found:', !!csrfToken);
    
    // ログインフォームを送信
    const formData = new URLSearchParams();
    if (csrfToken) formData.append('csrfmiddlewaretoken', csrfToken);
    formData.append('email', email);
    formData.append('password', password);
    // 一般的なフォームフィールド名も追加
    formData.append('login', email);
    formData.append('username', email);

    const loginResponse = await fetch('https://estama.jp/login', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'Referer': 'https://estama.jp/login',
        'Origin': 'https://estama.jp',
      },
      body: formData.toString(),
      redirect: 'manual',
    });
    
    console.log('Login response status:', loginResponse.status);
    
    // Set-Cookieヘッダーからセッションクッキーを取得
    const loginCookies = loginResponse.headers.getSetCookie?.() || [];
    const allCookies = [...setCookieHeaders, ...loginCookies]
      .map(c => c.split(';')[0])
      .filter(c => c.length > 0);
    
    const finalCookies = [...new Set(allCookies)].join('; ');
    
    // ログイン成功の確認（リダイレクトまたは200）
    if (loginResponse.status === 302 || loginResponse.status === 301 || loginResponse.status === 200) {
      // 管理ページにアクセスしてログイン確認
      const checkResponse = await fetch('https://estama.jp/admin/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': finalCookies,
        },
        redirect: 'manual',
      });
      
      console.log('Admin check status:', checkResponse.status);
      
      if (checkResponse.status === 200) {
        console.log('Login confirmed - admin access OK');
        return finalCookies;
      } else if (checkResponse.status >= 300 && checkResponse.status < 400) {
        console.log('Admin access redirected - login may have failed');
        // リダイレクト先を確認
        const location = checkResponse.headers.get('location');
        console.log('Redirect location:', location);
        
        // ショップ管理画面を試す
        const shopCheckResponse = await fetch('https://estama.jp/shop/43923/admin/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': finalCookies,
          },
          redirect: 'manual',
        });
        
        console.log('Shop admin check status:', shopCheckResponse.status);
        
        if (shopCheckResponse.status === 200) {
          console.log('Login confirmed - shop admin access OK');
          return finalCookies;
        }
      }
    }
    
    // ログインフォームが別のURLの可能性
    const altLoginUrls = [
      'https://estama.jp/accounts/login/',
      'https://estama.jp/api/login',
    ];
    
    for (const url of altLoginUrls) {
      try {
        const altResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies,
            'Referer': url,
            'Origin': 'https://estama.jp',
          },
          body: formData.toString(),
          redirect: 'manual',
        });
        
        console.log(`Alt login ${url} status:`, altResponse.status);
        
        if (altResponse.status === 302 || altResponse.status === 200) {
          const altCookies = altResponse.headers.getSetCookie?.() || [];
          const allAltCookies = [...allCookies, ...altCookies.map(c => c.split(';')[0])]
            .filter(c => c.length > 0);
          const result = [...new Set(allAltCookies)].join('; ');
          return result;
        }
      } catch (e) {
        console.log(`Alt login ${url} failed:`, e);
      }
    }
    
    console.warn('All login attempts failed');
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// === 管理画面のスケジュールパース ===
function parseAdminSchedule(html: string, dateStr: string): EstamaShift[] {
  const shifts: EstamaShift[] = [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
  const normalizeTime = (t: string) => {
    const m = t.match(/(\d{1,2}):(\d{2})/);
    if (!m) return '12:00:00';
    let h = parseInt(m[1], 10);
    if (h >= 24) h -= 24;
    return `${String(h).padStart(2, '0')}:${String(m[2]).padStart(2, '0')}:00`;
  };

  try {
    // 管理画面は公開ページと異なる構造の可能性がある
    // まず公開ページと同じパターンを試す
    const publicShifts = parseEstamaSchedule(html, dateStr);
    if (publicShifts.length > 0) return publicShifts;

    // 管理画面固有のパターン: テーブル行からセラピスト名と時間を抽出
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      
      if (cells.length >= 3) {
        const name = stripTags(cells[0][1]);
        if (!name || name.length < 2 || name.length > 20) continue;
        
        // 時間パターンを探す
        const timePattern = /(\d{1,2}:\d{2})\s*[-~～]\s*(\d{1,2}:\d{2})/;
        const fullRow = stripTags(rowMatch[0]);
        const timeMatch = fullRow.match(timePattern);
        
        if (timeMatch) {
          shifts.push({
            castName: name,
            date: dateStr,
            startTime: normalizeTime(timeMatch[1]),
            endTime: normalizeTime(timeMatch[2]),
            status: 'scheduled',
            castType: 'therapist',
          });
        }
      }
    }

    console.log(`Admin schedule parsed: ${shifts.length} shifts`);
  } catch (error) {
    console.error('Error parsing admin schedule:', error);
  }

  return shifts;
}

// === 管理画面のキャスト一覧パース ===
function parseAdminCastList(html: string): EstamaCastProfile[] {
  const profiles: EstamaCastProfile[] = [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

  try {
    // まず公開ページパーサーを試す
    const publicProfiles = parseEstamaCastList(html);
    if (publicProfiles.length > 0) return publicProfiles;

    // 管理画面固有: テーブル形式の一覧
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      
      if (cells.length >= 2) {
        // 名前を探す（リンクテキストまたはセル内容）
        const linkMatch = row.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        const name = linkMatch ? stripTags(linkMatch[1]) : stripTags(cells[0][1]);
        
        if (!name || name.length < 2 || name.length > 20) continue;
        if (/^\d+$/.test(name)) continue; // 数字のみはスキップ

        const profile: EstamaCastProfile = { name };
        const fullRow = stripTags(row);

        // 年齢
        const ageMatch = fullRow.match(/(\d{2})歳/);
        if (ageMatch) profile.age = parseInt(ageMatch[1]);

        // 身長
        const heightMatch = fullRow.match(/T(\d{3})/);
        if (heightMatch) profile.height = parseInt(heightMatch[1]);

        // 3サイズ
        const sizeMatch = fullRow.match(/B(\d{2,3})\s*[\(（]([A-K])[\)）]\s*[・\/]\s*W(\d{2})\s*[・\/]\s*H(\d{2,3})/i);
        if (sizeMatch) {
          profile.bust = parseInt(sizeMatch[1]);
          profile.cupSize = sizeMatch[2];
          profile.waist = parseInt(sizeMatch[3]);
          profile.hip = parseInt(sizeMatch[4]);
        }

        // 写真
        const imgMatch = row.match(/<img[^>]*src="(https?:\/\/[^"]+)"[^>]*>/i);
        if (imgMatch) profile.photos = [imgMatch[1]];

        if (!profiles.find(p => p.name === name)) {
          profiles.push(profile);
        }
      }
    }

    console.log(`Admin cast list parsed: ${profiles.length} profiles`);
  } catch (error) {
    console.error('Error parsing admin cast list:', error);
  }

  return profiles;
}

// === 公開ページのスケジュールパース ===
function parseEstamaSchedule(html: string, dateStr: string): EstamaShift[] {
  const shifts: EstamaShift[] = [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
  const normalizeTime = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '12:00:00';
    let h = parseInt(m[1], 10);
    if (h >= 24) h -= 24;
    return `${String(h).padStart(2, '0')}:${String(m[2]).padStart(2, '0')}:00`;
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
      } catch (e) {
        console.error('Error parsing therapist block:', e);
      }
    }
  } catch (error) {
    console.error('Error parsing public schedule:', error);
  }

  return shifts;
}

// === 公開ページのキャスト一覧パース ===
function parseEstamaCastList(html: string): EstamaCastProfile[] {
  const profiles: EstamaCastProfile[] = [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

  try {
    const nameRegex = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
    const nameMatches = [...html.matchAll(nameRegex)];
    
    for (const nameMatch of nameMatches) {
      const name = stripTags(nameMatch[1]);
      if (!name || name.length < 2 || name.length > 20) continue;
      
      const nameIndex = nameMatch.index || 0;
      const context = html.substring(Math.max(0, nameIndex - 500), Math.min(html.length, nameIndex + 2000));
      
      const profile: EstamaCastProfile = { name };
      
      const ageMatch = context.match(/(\d{2})歳/);
      if (ageMatch) profile.age = parseInt(ageMatch[1]);
      
      const heightMatch = context.match(/T(\d{3})/);
      if (heightMatch) profile.height = parseInt(heightMatch[1]);
      
      const sizeMatch = context.match(/B(\d{2,3})\s*[\(（]([A-K])[\)）]\s*[・\/]\s*W(\d{2})\s*[・\/]\s*H(\d{2,3})/i);
      if (sizeMatch) {
        profile.bust = parseInt(sizeMatch[1]);
        profile.cupSize = sizeMatch[2];
        profile.waist = parseInt(sizeMatch[3]);
        profile.hip = parseInt(sizeMatch[4]);
      }
      
      const imgMatch = context.match(/<img[^>]*src="(https?:\/\/[^"]*estama[^"]*)"[^>]*>/i);
      if (imgMatch) profile.photos = [imgMatch[1]];
      
      const commentMatch = context.match(/<p[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      if (commentMatch) profile.message = stripTags(commentMatch[1]).substring(0, 500);

      if (!profiles.find(p => p.name === name)) {
        profiles.push(profile);
      }
    }
  } catch (error) {
    console.error('Error parsing public cast list:', error);
  }

  return profiles;
}
