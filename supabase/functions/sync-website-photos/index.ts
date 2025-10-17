import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

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
    
    const websiteResponse = await fetch('https://zenryoku-esthe.com/therapist');
    const html = await websiteResponse.text();
    
    const $ = cheerio.load(html);
    
    const therapists: Array<{
      name: string;
      photoUrl: string;
      detailUrl: string;
    }> = [];

    // セラピスト情報を抽出
    $('a[href*="/therapist/"]').each((_, element) => {
      const $link = $(element);
      const detailUrl = $link.attr('href');
      const $img = $link.find('img');
      const photoUrl = $img.attr('src');
      const name = $img.attr('alt');

      if (name && photoUrl && detailUrl) {
        therapists.push({
          name: name.toUpperCase(),
          photoUrl: photoUrl.startsWith('http') ? photoUrl : `https://zenryoku-esthe.com${photoUrl}`,
          detailUrl: detailUrl.startsWith('http') ? detailUrl : `https://zenryoku-esthe.com${detailUrl}`
        });
      }
    });

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