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

        // プロパティから値を抽出
        const name = props.名前?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || '';
        const room = props.ルーム?.select?.name || props.Room?.select?.name || null;
        const type = props.type?.select?.name || props.Type?.select?.name || 'インルーム';
        const status = props.ステータス?.select?.name || props.Status?.select?.name || '未着手';
        const profile = props.プロフィール?.rich_text?.[0]?.plain_text || props.Profile?.rich_text?.[0]?.plain_text || '';
        
        // 実行日の日付範囲を取得
        let execution_date_start = null;
        let execution_date_end = null;
        if (props.実行日?.date || props['Execution Date']?.date) {
          const dateField = props.実行日?.date || props['Execution Date']?.date;
          execution_date_start = dateField.start || null;
          execution_date_end = dateField.end || null;
        }
        
        // HPのノティックとアップロードチェックのステータス
        const hp_notice = props.HPのノティック?.select?.name || props['HP Notice']?.select?.name || null;
        const upload_check = props.エスタジフトチェック?.select?.name || props['Upload Check']?.select?.name || null;
        
        // Xアカウント
        const x_account = props.Xアカウント?.url || props['X Account']?.url || null;
        
        // 写真5枚（複数の画像URLを配列として取得）
        const photos: string[] = [];
        if (props.写真5枚?.files || props['5 Photos']?.files) {
          const photoFiles = props.写真5枚?.files || props['5 Photos']?.files || [];
          for (const file of photoFiles.slice(0, 5)) { // 最大5枚
            const url = file.type === 'external' ? file.external.url : file.file.url;
            if (url) photos.push(url);
          }
        }
        
        // 後方互換性のため、最初の写真をphotoフィールドにも設定
        const photo = photos[0] || null;

        if (!name) {
          console.warn(`Skipping page ${page.id}: no name found`);
          continue;
        }

        // Supabaseにデータをupsert
        const { data, error } = await supabase
          .from('casts')
          .upsert({
            name,
            room,
            type,
            status,
            profile,
            execution_date_start,
            execution_date_end,
            hp_notice,
            upload_check,
            photos,
            x_account,
            photo, // 後方互換性のため
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
