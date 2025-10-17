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
    const therapists: Array<{
      name: string;
      photoUrl: string;
    }> = [];

    // セラピストの画像URLと名前を抽出
    // パターン: ![セラピスト名](画像URL)
    const imgRegex = /!\[([^\]]+)\]\((https:\/\/img\.estama\.jp\/shop_data\/[^\)]+)\)/g;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const name = match[1].trim();
      const photoUrl = match[2];
      
      if (name && photoUrl) {
        therapists.push({
          name: name.toUpperCase(),
          photoUrl: photoUrl
        });
      }
    }

    console.log(`Found ${therapists.length} therapists on website`);

    const syncResults = [];
    const errors = [];

    // 各セラピストの写真URLをデータベースに更新
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
          const { error: updateError } = await supabase
            .from('casts')
            .update({ photo: therapist.photoUrl })
            .eq('id', existingCast.id);

          if (updateError) {
            console.error(`Error updating ${therapist.name}:`, updateError);
            errors.push({ name: therapist.name, error: updateError.message });
          } else {
            console.log(`Updated photo for ${therapist.name}`);
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