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
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const notionDatabaseId = Deno.env.get('NOTION_DATABASE_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!notionApiKey || !notionDatabaseId) {
      throw new Error('Notion API key or Database ID not configured');
    }

    console.log('Fetching data from Notion database...');

    // Notionデータベースからデータを取得
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error('Notion API error:', errorText);
      throw new Error(`Notion API error: ${notionResponse.status}`);
    }

    const notionData = await notionResponse.json();
    console.log(`Found ${notionData.results.length} pages in Notion`);

    // Supabaseクライアントを作成
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const syncedCasts = [];
    const errors = [];

    // 各Notionページをキャストデータに変換
    for (const page of notionData.results) {
      try {
        const props = page.properties;

        // プロパティから値を抽出（Notionのプロパティ名に応じて調整が必要）
        const name = props.名前?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || '';
        const age = props.年齢?.number || props.Age?.number || 23;
        const type = props.ランク?.select?.name || props.Type?.select?.name || 'スタンダード';
        const price = props.料金?.number || props.Price?.number || 12000;
        const measurements = props.スリーサイズ?.rich_text?.[0]?.plain_text || props.Measurements?.rich_text?.[0]?.plain_text || '';
        const profile = props.プロフィール?.rich_text?.[0]?.plain_text || props.Profile?.rich_text?.[0]?.plain_text || '';
        const phone = props.電話番号?.phone_number || props.Phone?.phone_number || null;
        
        // 画像URLを取得（複数の方法で試行）
        let photo = null;
        
        // 方法1: Filesプロパティから
        if (props.写真?.files?.[0]) {
          const file = props.写真.files[0];
          photo = file.type === 'external' ? file.external.url : file.file.url;
        } else if (props.Photo?.files?.[0]) {
          const file = props.Photo.files[0];
          photo = file.type === 'external' ? file.external.url : file.file.url;
        }
        
        // 方法2: URLプロパティから
        if (!photo && props.画像URL?.url) {
          photo = props.画像URL.url;
        } else if (!photo && props.ImageURL?.url) {
          photo = props.ImageURL.url;
        }
        
        // 方法3: ページのカバー画像から
        if (!photo && page.cover) {
          photo = page.cover.type === 'external' ? page.cover.external.url : page.cover.file.url;
        }

        if (!name) {
          console.warn(`Skipping page ${page.id}: no name found`);
          continue;
        }

        // Supabaseにデータをupsert
        const { data, error } = await supabase
          .from('casts')
          .upsert({
            name,
            age,
            type,
            price,
            measurements,
            profile,
            phone,
            photo,
            status: 'offline',
            rating: 0,
          }, {
            onConflict: 'name',
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) {
          console.error(`Error syncing ${name}:`, error);
          errors.push({ name, error: error.message });
        } else {
          console.log(`Successfully synced: ${name}`);
          syncedCasts.push(data);
        }
      } catch (error) {
        console.error('Error processing page:', error);
        errors.push({ page: page.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCasts.length,
        errors: errors.length,
        details: {
          syncedCasts,
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
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
