import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOP_ID = '43923';
const BASE_URL = 'https://estama.jp';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pushType = body.pushType || 'all'; // 'schedule', 'profiles', 'photos', 'all'
    const castIds = body.castIds || []; // 特定のキャストのみ対象にする場合
    
    console.log(`Starting push to Estama (type: ${pushType})...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const estamaEmail = Deno.env.get('ESTAMA_EMAIL');
    const estamaPassword = Deno.env.get('ESTAMA_PASSWORD');

    if (!estamaEmail || !estamaPassword) {
      throw new Error('ESTAMA_EMAIL and ESTAMA_PASSWORD are required');
    }

    // エスたまにログイン
    const session = await loginToEstama(estamaEmail, estamaPassword);
    if (!session) {
      throw new Error('Failed to login to Estama');
    }
    console.log('Logged into Estama successfully');

    // 対象キャストを取得
    let castsQuery = supabase.from('casts').select('*');
    if (castIds.length > 0) {
      castsQuery = castsQuery.in('id', castIds);
    }
    const { data: castsData, error: castsError } = await castsQuery;
    if (castsError) throw castsError;
    
    const targetCasts = castsData || [];
    console.log(`Target casts: ${targetCasts.length}`);

    let schedulesUpdated = 0;
    let profilesUpdated = 0;
    let photosUploaded = 0;
    const errors: string[] = [];

    // === まずエスたま上のキャスト一覧を取得してIDマッピングを作成 ===
    const estamaIdMap = await getEstamaCastIdMap(session);
    console.log(`Estama cast map: ${estamaIdMap.size} entries`);

    // === スケジュール更新 ===
    if (pushType === 'schedule' || pushType === 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .gte('shift_date', todayStr);
      
      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
      } else {
        for (const shift of (shifts || [])) {
          const cast = targetCasts.find(c => c.id === shift.cast_id);
          if (!cast) continue;
          
          const estamaId = estamaIdMap.get(cast.name);
          if (!estamaId) {
            console.log(`No Estama ID found for ${cast.name}, skipping schedule`);
            continue;
          }

          try {
            const success = await pushScheduleToEstama(session, estamaId, {
              date: shift.shift_date,
              startTime: shift.start_time,
              endTime: shift.end_time,
            });
            if (success) schedulesUpdated++;
          } catch (e) {
            const msg = `Schedule push failed for ${cast.name} on ${shift.shift_date}: ${(e as Error).message}`;
            console.error(msg);
            errors.push(msg);
          }

          await new Promise(resolve => setTimeout(resolve, 800));
        }
        console.log(`Schedules updated: ${schedulesUpdated}`);
      }
    }

    // === プロフィール更新 ===
    if (pushType === 'profiles' || pushType === 'all') {
      for (const cast of targetCasts) {
        const estamaId = estamaIdMap.get(cast.name);
        if (!estamaId) {
          console.log(`No Estama ID found for ${cast.name}, skipping profile`);
          continue;
        }

        try {
          const success = await pushProfileToEstama(session, estamaId, {
            name: cast.name,
            age: cast.age,
            height: cast.height,
            bust: cast.bust,
            waist: cast.waist,
            hip: cast.hip,
            cupSize: cast.cup_size,
            profile: cast.profile,
            message: cast.message,
            hpNotice: cast.hp_notice,
          });
          if (success) profilesUpdated++;
        } catch (e) {
          const msg = `Profile push failed for ${cast.name}: ${(e as Error).message}`;
          console.error(msg);
          errors.push(msg);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
      }
      console.log(`Profiles updated: ${profilesUpdated}`);
    }

    // === 写真アップロード ===
    if (pushType === 'photos' || pushType === 'all') {
      for (const cast of targetCasts) {
        const estamaId = estamaIdMap.get(cast.name);
        if (!estamaId) continue;

        const photos = cast.photos || (cast.photo ? [cast.photo] : []);
        if (photos.length === 0) continue;

        try {
          const uploaded = await pushPhotosToEstama(session, estamaId, photos);
          photosUploaded += uploaded;
        } catch (e) {
          const msg = `Photo push failed for ${cast.name}: ${(e as Error).message}`;
          console.error(msg);
          errors.push(msg);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log(`Photos uploaded: ${photosUploaded}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        schedulesUpdated,
        profilesUpdated,
        photosUploaded,
        errors: errors.length > 0 ? errors : undefined,
        message: 'Push to Estama completed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in push-to-estama:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// === エスたまログイン ===
async function loginToEstama(email: string, password: string): Promise<EstamaSession | null> {
  try {
    // ログインページを取得
    const loginPageRes = await fetch(`${BASE_URL}/login`, {
      headers: { 'User-Agent': userAgent() },
      redirect: 'manual',
    });
    
    const loginHtml = await loginPageRes.text();
    const initCookies = extractCookies(loginPageRes);
    
    // CSRFトークン取得
    const csrfToken = extractCsrf(loginHtml);
    console.log('CSRF token:', csrfToken ? 'found' : 'not found');

    // ログインPOST
    const formData = new URLSearchParams();
    if (csrfToken) formData.append('csrfmiddlewaretoken', csrfToken);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('login', email);
    formData.append('username', email);

    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initCookies,
        'Referer': `${BASE_URL}/login`,
        'Origin': BASE_URL,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    console.log('Login response:', loginRes.status);
    const loginSetCookies = extractCookies(loginRes);
    const allCookies = mergeCookies(initCookies, loginSetCookies);

    // フォローリダイレクト
    if (loginRes.status >= 300 && loginRes.status < 400) {
      const location = loginRes.headers.get('location');
      if (location) {
        const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`;
        const redirectRes = await fetch(redirectUrl, {
          headers: { 'User-Agent': userAgent(), 'Cookie': allCookies },
          redirect: 'manual',
        });
        const redirectCookies = extractCookies(redirectRes);
        const finalCookies = mergeCookies(allCookies, redirectCookies);
        return { cookies: finalCookies };
      }
    }

    if (loginRes.status === 200 || loginRes.status >= 300) {
      return { cookies: allCookies };
    }

    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// === エスたまキャストIDマッピング取得 ===
async function getEstamaCastIdMap(session: EstamaSession): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  
  try {
    // 管理画面のキャスト一覧ページを取得
    const urls = [
      `${BASE_URL}/shop/${SHOP_ID}/admin/cast/`,
      `${BASE_URL}/admin/cast/`,
      `${BASE_URL}/shop/${SHOP_ID}/cast/`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': userAgent(), 'Cookie': session.cookies },
          redirect: 'manual',
        });
        
        if (res.status !== 200) continue;
        
        const html = await res.text();
        
        // キャスト名とIDのマッピングを抽出
        // パターン1: /cast/123/ のようなリンク + 名前
        const linkRegex = /href="[^"]*\/cast\/(\d+)\/?[^"]*"[^>]*>[\s\S]*?<[^>]*>([^<]+)</gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const id = match[1];
          const name = match[2].trim();
          if (name && name.length >= 2 && name.length <= 20) {
            map.set(name, id);
          }
        }

        // パターン2: data-id="123" + 名前
        const dataIdRegex = /data-(?:cast-)?id="(\d+)"[\s\S]*?(?:<h[234][^>]*>|class="[^"]*name[^"]*"[^>]*>)\s*([^<]+)/gi;
        while ((match = dataIdRegex.exec(html)) !== null) {
          const id = match[1];
          const name = match[2].trim();
          if (name && name.length >= 2 && !map.has(name)) {
            map.set(name, id);
          }
        }

        // パターン3: 一般的なテーブル行
        const rowRegex = /<tr[^>]*>[\s\S]*?(\d{3,8})[\s\S]*?<(?:td|a)[^>]*>\s*([^\d<][^<]{1,19})\s*<\//gi;
        while ((match = rowRegex.exec(html)) !== null) {
          const id = match[1];
          const name = match[2].trim();
          if (name && name.length >= 2 && !map.has(name)) {
            map.set(name, id);
          }
        }

        if (map.size > 0) {
          console.log(`Found ${map.size} cast IDs from ${url}`);
          break;
        }
      } catch (e) {
        console.log(`Failed to fetch ${url}:`, e);
      }
    }

    // 公開ページからもフォールバック
    if (map.size === 0) {
      const pubRes = await fetch(`${BASE_URL}/shop/${SHOP_ID}/cast/`, {
        headers: { 'User-Agent': userAgent() },
      });
      const pubHtml = await pubRes.text();
      
      const linkRegex = /href="[^"]*\/cast\/(\d+)\/?[^"]*"[\s\S]*?<h4[^>]*>\s*([^<]+)/gi;
      let match;
      while ((match = linkRegex.exec(pubHtml)) !== null) {
        const id = match[1];
        const name = match[2].trim();
        if (name && name.length >= 2) {
          map.set(name, id);
        }
      }
      console.log(`Fallback: Found ${map.size} cast IDs from public page`);
    }
  } catch (error) {
    console.error('Error getting cast ID map:', error);
  }

  return map;
}

// === スケジュールをエスたまにプッシュ ===
async function pushScheduleToEstama(
  session: EstamaSession,
  castId: string,
  schedule: { date: string; startTime: string; endTime: string }
): Promise<boolean> {
  // 管理画面のスケジュール編集ページを取得
  const editUrls = [
    `${BASE_URL}/shop/${SHOP_ID}/admin/schedule/edit/?cast=${castId}&date=${schedule.date}`,
    `${BASE_URL}/admin/schedule/edit/?cast=${castId}&date=${schedule.date}`,
    `${BASE_URL}/shop/${SHOP_ID}/admin/cast/${castId}/schedule/`,
  ];

  for (const editUrl of editUrls) {
    try {
      const pageRes = await fetch(editUrl, {
        headers: { 'User-Agent': userAgent(), 'Cookie': session.cookies },
        redirect: 'manual',
      });
      
      if (pageRes.status !== 200) continue;
      
      const html = await pageRes.text();
      const csrf = extractCsrf(html);

      // フォームPOST
      const formData = new URLSearchParams();
      if (csrf) formData.append('csrfmiddlewaretoken', csrf);
      formData.append('cast_id', castId);
      formData.append('date', schedule.date);
      formData.append('start_time', schedule.startTime.replace(':00', ''));
      formData.append('end_time', schedule.endTime.replace(':00', ''));
      formData.append('status', 'scheduled');

      const postRes = await fetch(editUrl, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': session.cookies,
          'Referer': editUrl,
          'Origin': BASE_URL,
        },
        body: formData.toString(),
        redirect: 'manual',
      });

      console.log(`Schedule push for cast ${castId} on ${schedule.date}: ${postRes.status}`);
      
      if (postRes.status === 200 || postRes.status === 302) {
        return true;
      }
    } catch (e) {
      console.log(`Schedule push attempt failed for ${editUrl}:`, e);
    }
  }

  return false;
}

// === プロフィールをエスたまにプッシュ ===
async function pushProfileToEstama(
  session: EstamaSession,
  castId: string,
  profile: {
    name: string;
    age?: number | null;
    height?: number | null;
    bust?: number | null;
    waist?: number | null;
    hip?: number | null;
    cupSize?: string | null;
    profile?: string | null;
    message?: string | null;
    hpNotice?: string | null;
  }
): Promise<boolean> {
  const editUrls = [
    `${BASE_URL}/shop/${SHOP_ID}/admin/cast/${castId}/edit/`,
    `${BASE_URL}/admin/cast/${castId}/edit/`,
    `${BASE_URL}/shop/${SHOP_ID}/admin/cast/${castId}/`,
  ];

  for (const editUrl of editUrls) {
    try {
      const pageRes = await fetch(editUrl, {
        headers: { 'User-Agent': userAgent(), 'Cookie': session.cookies },
        redirect: 'manual',
      });
      
      if (pageRes.status !== 200) continue;
      
      const html = await pageRes.text();
      const csrf = extractCsrf(html);

      // フォームフィールドを解析して既存値を維持しつつ更新
      const formData = new URLSearchParams();
      if (csrf) formData.append('csrfmiddlewaretoken', csrf);
      
      formData.append('name', profile.name);
      if (profile.age) formData.append('age', String(profile.age));
      if (profile.height) formData.append('height', String(profile.height));
      if (profile.bust) formData.append('bust', String(profile.bust));
      if (profile.waist) formData.append('waist', String(profile.waist));
      if (profile.hip) formData.append('hip', String(profile.hip));
      if (profile.cupSize) formData.append('cup_size', profile.cupSize);
      if (profile.profile) formData.append('profile', profile.profile);
      if (profile.message) formData.append('message', profile.message);
      if (profile.hpNotice) formData.append('hp_notice', profile.hpNotice);

      // エスたまの一般的なフィールド名パターンも試す
      if (profile.profile) formData.append('description', profile.profile);
      if (profile.profile) formData.append('introduction', profile.profile);
      if (profile.message) formData.append('comment', profile.message);

      const postRes = await fetch(editUrl, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': session.cookies,
          'Referer': editUrl,
          'Origin': BASE_URL,
        },
        body: formData.toString(),
        redirect: 'manual',
      });

      console.log(`Profile push for ${profile.name} (${castId}): ${postRes.status}`);
      
      if (postRes.status === 200 || postRes.status === 302) {
        return true;
      }
    } catch (e) {
      console.log(`Profile push attempt failed for ${editUrl}:`, e);
    }
  }

  return false;
}

// === 写真をエスたまにアップロード ===
async function pushPhotosToEstama(
  session: EstamaSession,
  castId: string,
  photoUrls: string[]
): Promise<number> {
  let uploaded = 0;

  const uploadUrls = [
    `${BASE_URL}/shop/${SHOP_ID}/admin/cast/${castId}/photo/`,
    `${BASE_URL}/admin/cast/${castId}/photo/upload/`,
    `${BASE_URL}/shop/${SHOP_ID}/admin/cast/${castId}/edit/`,
  ];

  for (const photoUrl of photoUrls) {
    try {
      // 写真をダウンロード
      const photoRes = await fetch(photoUrl);
      if (!photoRes.ok) {
        console.log(`Failed to download photo: ${photoUrl}`);
        continue;
      }
      
      const photoBlob = await photoRes.blob();
      const fileName = `photo_${Date.now()}.jpg`;

      for (const uploadUrl of uploadUrls) {
        try {
          // アップロードページを取得してCSRF取得
          const pageRes = await fetch(uploadUrl, {
            headers: { 'User-Agent': userAgent(), 'Cookie': session.cookies },
            redirect: 'manual',
          });
          
          if (pageRes.status !== 200) continue;
          
          const html = await pageRes.text();
          const csrf = extractCsrf(html);

          // multipart/form-dataで送信
          const formData = new FormData();
          if (csrf) formData.append('csrfmiddlewaretoken', csrf);
          formData.append('photo', photoBlob, fileName);
          formData.append('image', photoBlob, fileName);
          formData.append('file', photoBlob, fileName);

          const postRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'User-Agent': userAgent(),
              'Cookie': session.cookies,
              'Referer': uploadUrl,
              'Origin': BASE_URL,
            },
            body: formData,
            redirect: 'manual',
          });

          console.log(`Photo upload to ${uploadUrl}: ${postRes.status}`);
          
          if (postRes.status === 200 || postRes.status === 302) {
            uploaded++;
            break;
          }
        } catch (e) {
          console.log(`Photo upload attempt failed for ${uploadUrl}:`, e);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`Error uploading photo ${photoUrl}:`, e);
    }
  }

  return uploaded;
}

// === ユーティリティ ===

interface EstamaSession {
  cookies: string;
}

function userAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

function extractCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() || [];
  return setCookies.map(c => c.split(';')[0]).filter(c => c.length > 0).join('; ');
}

function mergeCookies(existing: string, newer: string): string {
  const map = new Map<string, string>();
  for (const c of existing.split('; ').filter(c => c)) {
    const [k] = c.split('=');
    map.set(k, c);
  }
  for (const c of newer.split('; ').filter(c => c)) {
    const [k] = c.split('=');
    map.set(k, c);
  }
  return [...map.values()].join('; ');
}

function extractCsrf(html: string): string {
  const match = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/i)
    || html.match(/name="_token"\s+value="([^"]+)"/i)
    || html.match(/csrf[_-]?token['"]\s*(?:content|value)=['"]([\w-]+)['"]/i);
  return match ? match[1] : '';
}
