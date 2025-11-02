import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TherapistData {
  name: string;
  photoUrl: string;
  photoUrls: string[];
  castId: string;
  age: number;
  tags: string[];
  height?: number;
  bust?: number;
  cupSize?: string;
  waist?: number;
  hip?: number;
  bodyType?: string;
  experienceYears?: number;
  specialties?: string;
  bloodType?: string;
  favoriteFood?: string;
  idealType?: string;
  celebrityLookalike?: string;
  dayOffActivities?: string;
  hobbies?: string;
  message?: string;
  xAccount?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching therapist page from website...');
    
    const websiteResponse = await fetch('https://estama.jp/shop/43923/cast/');
    
    if (!websiteResponse.ok) {
      throw new Error(`Failed to fetch website: ${websiteResponse.status}`);
    }
    
    const html = await websiteResponse.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const therapists: TherapistData[] = [];
    
    // 各セラピストのブロックを取得
    const castBlocks = doc.querySelectorAll('.mix');
    
    console.log(`Found ${castBlocks.length} cast blocks on page`);
    
    for (const block of castBlocks) {
      try {
        // 画像URLを取得
        const imgElement = block.querySelector('.therapist__img');
        const photoUrl = imgElement?.getAttribute('src');
        const altName = imgElement?.getAttribute('alt');
        
        // 名前と年齢を取得
        const h4Element = block.querySelector('h4');
        const h4Text = h4Element?.textContent?.trim() || '';
        const nameMatch = h4Text.match(/^(.+?)\((\d+)\)$/);
        
        // 詳細ページURLを取得
        const linkElement = block.querySelector('.link-detail');
        const detailUrl = linkElement?.getAttribute('href');
        const castIdMatch = detailUrl?.match(/\/cast\/(\d+)\//);
        
        if (!photoUrl || !nameMatch || !castIdMatch) {
          console.log('Skipping incomplete cast entry');
          continue;
        }
        
        const name = nameMatch[1].trim();
        const age = parseInt(nameMatch[2]);
        const castId = castIdMatch[1];
        
        console.log(`Processing: ${name} (${age}) - ID: ${castId}`);
        
        // タグを取得（人気セラピスト、新人など）
        const tags: string[] = [];
        const badgeElements = block.querySelectorAll('.icon-badge');
        for (const badge of badgeElements) {
          const tagText = badge.textContent?.trim();
          if (tagText) {
            tags.push(tagText);
          }
        }
        
        // サイズ情報を取得
        const sizeElement = block.querySelector('.therapist_details p');
        const sizeText = sizeElement?.textContent?.trim() || '';
        const sizeMatch = sizeText.match(/T\.(\d+)\s+B\.(\d+)\(([A-Z])\)\s+W\.(\d+)\s+H\.(\d+)/);
        
        const therapistData: TherapistData = {
          name: name,
          photoUrl: photoUrl,
          photoUrls: [photoUrl],
          castId: castId,
          age: age,
          tags: tags,
        };
        
        if (sizeMatch) {
          therapistData.height = parseInt(sizeMatch[1]);
          therapistData.bust = parseInt(sizeMatch[2]);
          therapistData.cupSize = sizeMatch[3];
          therapistData.waist = parseInt(sizeMatch[4]);
          therapistData.hip = parseInt(sizeMatch[5]);
        }
        
        // 詳細ページから追加情報を取得
        try {
          console.log(`Fetching detail page: ${detailUrl}`);
          const detailResponse = await fetch(detailUrl);
          
          if (detailResponse.ok) {
            const detailHtml = await detailResponse.text();
            const detailDoc = parser.parseFromString(detailHtml, 'text/html');
            
            if (detailDoc) {
              // プロフィールテーブルから情報を抽出
              const profileRows = detailDoc.querySelectorAll('.therapist__profile-table tr');
              
              for (const row of profileRows) {
                const th = row.querySelector('th')?.textContent?.trim();
                const td = row.querySelector('td')?.textContent?.trim();
                
                if (!th || !td) continue;
                
                switch (th) {
                  case '体型':
                    therapistData.bodyType = td;
                    break;
                  case 'エステ歴':
                    const yearsMatch = td.match(/(\d+)/);
                    if (yearsMatch) {
                      therapistData.experienceYears = parseInt(yearsMatch[1]);
                    }
                    break;
                  case '得意な施術':
                    therapistData.specialties = td;
                    break;
                  case '血液型':
                    therapistData.bloodType = td;
                    break;
                  case '好きな食べ物':
                    therapistData.favoriteFood = td;
                    break;
                  case '好きな男性のタイプ':
                    therapistData.idealType = td;
                    break;
                  case '似ている芸能人':
                    therapistData.celebrityLookalike = td;
                    break;
                  case '休みの日は何してる？':
                    therapistData.dayOffActivities = td;
                    break;
                  case '趣味・特技':
                    therapistData.hobbies = td;
                    break;
                }
              }
              
              // メッセージを抽出
              const messageSection = detailDoc.querySelector('.therapist__message');
              if (messageSection) {
                const messageParagraphs = messageSection.querySelectorAll('p');
                const messages: string[] = [];
                for (const p of messageParagraphs) {
                  const text = p.textContent?.trim();
                  if (text) messages.push(text);
                }
                therapistData.message = messages.join('\n');
              }
              
              // Xアカウントを抽出
              const xLink = detailDoc.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
              if (xLink) {
                const href = xLink.getAttribute('href');
                const xMatch = href?.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
                if (xMatch) {
                  therapistData.xAccount = xMatch[1];
                }
              }
              
              // 画像を全て取得（メイン画像 + ギャラリー画像）
              const allPhotoUrls: string[] = [photoUrl];
              
              // ギャラリー画像を取得
              const galleryImages = detailDoc.querySelectorAll('.therapist__gallery img, .therapist__photo img, .slider img');
              for (const img of galleryImages) {
                const imgSrc = img.getAttribute('src');
                if (imgSrc && !allPhotoUrls.includes(imgSrc)) {
                  allPhotoUrls.push(imgSrc);
                }
              }
              
              // data-srcやdata-lazy属性もチェック
              const lazyImages = detailDoc.querySelectorAll('img[data-src], img[data-lazy]');
              for (const img of lazyImages) {
                const imgSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy');
                if (imgSrc && !allPhotoUrls.includes(imgSrc)) {
                  allPhotoUrls.push(imgSrc);
                }
              }
              
              therapistData.photoUrls = allPhotoUrls.slice(0, 5); // 最大5枚
              console.log(`Found ${therapistData.photoUrls.length} photos for ${name}`);
            }
          } else {
            console.log(`Failed to fetch detail page for ${name}: ${detailResponse.status}`);
          }
        } catch (error) {
          console.error(`Error fetching detail page for ${name}:`, error);
        }
        
        therapists.push(therapistData);
        
        // レート制限を避けるため、少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error('Error processing cast block:', error);
      }
    }

    console.log(`Successfully parsed ${therapists.length} therapists`);

    const syncResults = [];
    const errors = [];
    
    // 写真をダウンロードしてSupabaseストレージに保存する関数
    const downloadAndUploadPhoto = async (photoUrl: string, castName: string, castId: string): Promise<string | null> => {
      try {
        console.log(`Downloading photo for ${castName} from ${photoUrl}`);
        
        // 写真をダウンロード
        const photoResponse = await fetch(photoUrl);
        if (!photoResponse.ok) {
          throw new Error(`Failed to download photo: ${photoResponse.status}`);
        }
        
        const photoBlob = await photoResponse.arrayBuffer();
        
        // ファイル名を生成（cast_id + timestamp）
        const fileExtension = photoUrl.includes('.jpg') ? 'jpg' : photoUrl.includes('.png') ? 'png' : 'webp';
        const fileName = `${castId}_${Date.now()}.${fileExtension}`;
        const filePath = `${fileName}`;
        
        // Supabaseストレージにアップロード
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cast-photos')
          .upload(filePath, photoBlob, {
            contentType: `image/${fileExtension}`,
            upsert: true
          });
        
        if (uploadError) {
          console.error(`Upload error for ${castName}:`, uploadError);
          return null;
        }
        
        // 公開URLを取得
        const { data: publicUrlData } = supabase.storage
          .from('cast-photos')
          .getPublicUrl(filePath);
        
        console.log(`✓ Uploaded photo for ${castName}: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
        
      } catch (error) {
        console.error(`Error downloading/uploading photo for ${castName}:`, error);
        return null;
      }
    };

    // 各セラピストの情報をデータベースに更新または作成
    for (const therapist of therapists) {
      try {
        // 名前で検索（大文字小文字を区別しない）
        const { data: existingCast, error: searchError } = await supabase
          .from('casts')
          .select('id, name')
          .ilike('name', therapist.name)
          .maybeSingle();

        if (searchError) {
          console.error(`Error searching for ${therapist.name}:`, searchError);
          errors.push({ name: therapist.name, error: searchError.message });
          continue;
        }

        // 全ての写真をダウンロードしてストレージに保存
        const uploadedPhotoUrls: string[] = [];
        for (const photoUrl of therapist.photoUrls) {
          const uploadedUrl = await downloadAndUploadPhoto(
            photoUrl,
            therapist.name,
            therapist.castId
          );
          if (uploadedUrl) {
            uploadedPhotoUrls.push(uploadedUrl);
          }
        }
        
        // プロフィール情報を準備
        const profileData: any = { 
          photo: uploadedPhotoUrls[0] || therapist.photoUrl,
          photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : [therapist.photoUrl],
          name: therapist.name,
          type: 'therapist', // デフォルト値
          tags: therapist.tags,
        };
        
        if (therapist.age !== undefined) profileData.age = therapist.age;
        if (therapist.height !== undefined) profileData.height = therapist.height;
        if (therapist.bust !== undefined) profileData.bust = therapist.bust;
        if (therapist.cupSize !== undefined) profileData.cup_size = therapist.cupSize;
        if (therapist.waist !== undefined) profileData.waist = therapist.waist;
        if (therapist.hip !== undefined) profileData.hip = therapist.hip;
        if (therapist.bodyType !== undefined) profileData.body_type = therapist.bodyType;
        if (therapist.experienceYears !== undefined) profileData.experience_years = therapist.experienceYears;
        if (therapist.specialties !== undefined) profileData.specialties = therapist.specialties;
        if (therapist.bloodType !== undefined) profileData.blood_type = therapist.bloodType;
        if (therapist.favoriteFood !== undefined) profileData.favorite_food = therapist.favoriteFood;
        if (therapist.idealType !== undefined) profileData.ideal_type = therapist.idealType;
        if (therapist.celebrityLookalike !== undefined) profileData.celebrity_lookalike = therapist.celebrityLookalike;
        if (therapist.dayOffActivities !== undefined) profileData.day_off_activities = therapist.dayOffActivities;
        if (therapist.hobbies !== undefined) profileData.hobbies = therapist.hobbies;
        if (therapist.message !== undefined) profileData.message = therapist.message;
        if (therapist.xAccount !== undefined) profileData.x_account = therapist.xAccount;

        if (existingCast) {
          // 既存のキャストを更新
          const { error: updateError } = await supabase
            .from('casts')
            .update(profileData)
            .eq('id', existingCast.id);

          if (updateError) {
            console.error(`Error updating ${therapist.name}:`, updateError);
            errors.push({ name: therapist.name, error: updateError.message });
          } else {
            console.log(`✓ Updated profile for ${therapist.name}`);
            syncResults.push({
              name: therapist.name,
              action: 'updated',
              photoUrl: therapist.photoUrl,
              profileData: {
                age: therapist.age,
                height: therapist.height,
                measurements: therapist.bust && therapist.waist && therapist.hip 
                  ? `${therapist.bust}(${therapist.cupSize})-${therapist.waist}-${therapist.hip}`
                  : undefined,
              }
            });
          }
        } else {
          // 新規キャストを作成
          const { error: insertError } = await supabase
            .from('casts')
            .insert(profileData);

          if (insertError) {
            console.error(`Error creating ${therapist.name}:`, insertError);
            errors.push({ name: therapist.name, error: insertError.message });
          } else {
            console.log(`✓ Created new profile for ${therapist.name}`);
            syncResults.push({
              name: therapist.name,
              action: 'created',
              photoUrl: therapist.photoUrl,
              profileData: {
                age: therapist.age,
                height: therapist.height,
                measurements: therapist.bust && therapist.waist && therapist.hip 
                  ? `${therapist.bust}(${therapist.cupSize})-${therapist.waist}-${therapist.hip}`
                  : undefined,
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error processing ${therapist.name}:`, error);
        errors.push({ 
          name: therapist.name, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncResults.length,
        errors: errors.length,
        total: therapists.length,
        details: {
          syncResults,
          errors,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
