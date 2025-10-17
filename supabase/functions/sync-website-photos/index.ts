import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    // エステ魂サイトのHTML解析
    interface TherapistData {
      name: string;
      photoUrl: string;
      castId: string;
      age?: number;
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
    
    const therapists: TherapistData[] = [];

    // 各セラピストのブロックを抽出
    // パターン: 画像 -> 名前(年齢) -> サイズ -> VIEW DETAILリンク
    const castBlockRegex = /!\[([^\]]+)\]\((https:\/\/img\.estama\.jp\/shop_data\/[^\)]+)\)[\s\S]*?####\s*([^\(]+)\((\d+)\)[\s\S]*?\[VIEW DETAIL\]\(https:\/\/estama\.jp\/shop\/43923\/cast\/(\d+)\/\)/g;
    let match;
    
    while ((match = castBlockRegex.exec(html)) !== null) {
      const name = match[3].trim();
      const photoUrl = match[2];
      const age = parseInt(match[4]);
      const castId = match[5];
      
      if (name && photoUrl && castId) {
        console.log(`Found therapist: ${name} (ID: ${castId})`);
        
        // 詳細ページから追加情報を取得
        try {
          const detailResponse = await fetch(`https://estama.jp/shop/43923/cast/${castId}/`);
          
          if (detailResponse.ok) {
            const detailHtml = await detailResponse.text();
            
            // サイズ情報を抽出: T.157B.85(E)W.58H.80
            const sizeMatch = detailHtml.match(/T\.(\d+)B\.(\d+)\(([A-Z])\)W\.(\d+)H\.(\d+)/);
            
            // プロフィール詳細を抽出
            const profileMatch = detailHtml.match(/体型([^\s]+)エステ歴(\d+)年得意な施術([^血]+)血液型([^\s]+)好きな食べ物([^好]+)好きな男性のタイプ([^似]+)似ている芸能人([^休]+)休みの日は何してる？([^趣]+)趣味・特技([^セ]+)/);
            
            // メッセージを抽出
            const messageMatch = detailHtml.match(/セラピストからのメッセージ<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/);
            
            // Xアカウントを抽出
            const xAccountMatch = detailHtml.match(/https:\/\/twitter\.com\/([^"']+)/);
            
            therapists.push({
              name: name.toUpperCase(),
              photoUrl: photoUrl,
              castId: castId,
              age: age,
              height: sizeMatch ? parseInt(sizeMatch[1]) : undefined,
              bust: sizeMatch ? parseInt(sizeMatch[2]) : undefined,
              cupSize: sizeMatch ? sizeMatch[3] : undefined,
              waist: sizeMatch ? parseInt(sizeMatch[4]) : undefined,
              hip: sizeMatch ? parseInt(sizeMatch[5]) : undefined,
              bodyType: profileMatch ? profileMatch[1] : undefined,
              experienceYears: profileMatch ? parseInt(profileMatch[2]) : undefined,
              specialties: profileMatch ? profileMatch[3].trim() : undefined,
              bloodType: profileMatch ? profileMatch[4] : undefined,
              favoriteFood: profileMatch ? profileMatch[5].trim() : undefined,
              idealType: profileMatch ? profileMatch[6].trim() : undefined,
              celebrityLookalike: profileMatch ? profileMatch[7].trim() : undefined,
              dayOffActivities: profileMatch ? profileMatch[8].trim() : undefined,
              hobbies: profileMatch ? profileMatch[9].trim() : undefined,
              message: messageMatch ? messageMatch[1].replace(/<[^>]+>/g, '').trim() : undefined,
              xAccount: xAccountMatch ? xAccountMatch[1] : undefined,
            });
          } else {
            console.log(`Failed to fetch detail page for ${name}: ${detailResponse.status}`);
            // 詳細情報なしでも基本情報は保存
            therapists.push({
              name: name.toUpperCase(),
              photoUrl: photoUrl,
              castId: castId,
              age: age,
            });
          }
        } catch (error) {
          console.error(`Error fetching detail page for ${name}:`, error);
          // 詳細情報なしでも基本情報は保存
          therapists.push({
            name: name.toUpperCase(),
            photoUrl: photoUrl,
            castId: castId,
            age: age,
          });
        }
      }
    }

    console.log(`Found ${therapists.length} therapists on website`);

    const syncResults = [];
    const errors = [];

    // 各セラピストの情報をデータベースに更新
    for (const therapist of therapists) {
      try {
        // 名前で検索（大文字小文字を区別しない）
        const { data: existingCast, error: searchError } = await supabase
          .from('casts')
          .select('id, name, photo')
          .ilike('name', therapist.name)
          .maybeSingle();

        if (searchError) {
          console.error(`Error searching for ${therapist.name}:`, searchError);
          errors.push({ name: therapist.name, error: searchError.message });
          continue;
        }

        if (existingCast) {
          // 既存のキャストを更新
          const updateData: any = { 
            photo: therapist.photoUrl,
          };
          
          // プロフィール情報を追加
          if (therapist.age !== undefined) updateData.age = therapist.age;
          if (therapist.height !== undefined) updateData.height = therapist.height;
          if (therapist.bust !== undefined) updateData.bust = therapist.bust;
          if (therapist.cupSize !== undefined) updateData.cup_size = therapist.cupSize;
          if (therapist.waist !== undefined) updateData.waist = therapist.waist;
          if (therapist.hip !== undefined) updateData.hip = therapist.hip;
          if (therapist.bodyType !== undefined) updateData.body_type = therapist.bodyType;
          if (therapist.experienceYears !== undefined) updateData.experience_years = therapist.experienceYears;
          if (therapist.specialties !== undefined) updateData.specialties = therapist.specialties;
          if (therapist.bloodType !== undefined) updateData.blood_type = therapist.bloodType;
          if (therapist.favoriteFood !== undefined) updateData.favorite_food = therapist.favoriteFood;
          if (therapist.idealType !== undefined) updateData.ideal_type = therapist.idealType;
          if (therapist.celebrityLookalike !== undefined) updateData.celebrity_lookalike = therapist.celebrityLookalike;
          if (therapist.dayOffActivities !== undefined) updateData.day_off_activities = therapist.dayOffActivities;
          if (therapist.hobbies !== undefined) updateData.hobbies = therapist.hobbies;
          if (therapist.message !== undefined) updateData.message = therapist.message;
          if (therapist.xAccount !== undefined) updateData.x_account = therapist.xAccount;

          const { error: updateError } = await supabase
            .from('casts')
            .update(updateData)
            .eq('id', existingCast.id);

          if (updateError) {
            console.error(`Error updating ${therapist.name}:`, updateError);
            errors.push({ name: therapist.name, error: updateError.message });
          } else {
            console.log(`Updated profile for ${therapist.name}`);
            syncResults.push({
              name: therapist.name,
              action: 'updated',
              photoUrl: therapist.photoUrl
            });
          }
        } else {
          console.log(`No matching cast found for ${therapist.name}`);
          errors.push({ 
            name: therapist.name, 
            error: 'Cast not found in database' 
          });
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
