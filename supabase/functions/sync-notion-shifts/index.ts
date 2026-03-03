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

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const body = await req.json().catch(() => ({}));
    const direction = body.direction || 'both'; // 'notion-to-db', 'db-to-notion', 'both'

    const results = { notionToDb: { synced: 0, errors: [] as any[] }, dbToNotion: { synced: 0, errors: [] as any[] } };

    // ========== Notion → DB ==========
    if (direction === 'notion-to-db' || direction === 'both') {
      console.log('Syncing shifts from Notion to DB...');

      // Fetch all pages from Notion DB (cast DB with shift info)
      let allPages: any[] = [];
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
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
              ...(startCursor ? { start_cursor: startCursor } : {}),
            }),
          }
        );

        if (!notionResponse.ok) {
          const errorText = await notionResponse.text();
          throw new Error(`Notion API error: ${notionResponse.status} - ${errorText}`);
        }

        const data = await notionResponse.json();
        allPages = allPages.concat(data.results);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }

      console.log(`Found ${allPages.length} pages in Notion`);

      // Get all casts from DB for name→id mapping
      const { data: casts } = await supabase.from('casts').select('id, name');
      const castNameToId: Record<string, string> = {};
      for (const cast of (casts || [])) {
        castNameToId[cast.name] = cast.id;
      }

      for (const page of allPages) {
        try {
          const props = page.properties;

          // Extract cast name
          const name = props.名前?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || '';
          if (!name || !castNameToId[name]) {
            continue;
          }

          const castId = castNameToId[name];

          // Extract shift date (実行日 / Execution Date)
          const dateField = props.実行日?.date || props['Execution Date']?.date;
          if (!dateField?.start) continue;

          const shiftDate = dateField.start;

          // Extract start/end time (出勤時間 / Shift Start, 退勤時間 / Shift End)
          const startTimeRaw = props.出勤時間?.rich_text?.[0]?.plain_text 
            || props['Shift Start']?.rich_text?.[0]?.plain_text
            || props.開始時間?.rich_text?.[0]?.plain_text
            || '10:00';
          const endTimeRaw = props.退勤時間?.rich_text?.[0]?.plain_text 
            || props['Shift End']?.rich_text?.[0]?.plain_text
            || props.終了時間?.rich_text?.[0]?.plain_text
            || '22:00';

          // Normalize time format
          const startTime = normalizeTime(startTimeRaw);
          const endTime = normalizeTime(endTimeRaw);

          // Room
          const room = props.ルーム?.select?.name || props.Room?.select?.name || null;

          // Notes
          const notes = props.メモ?.rich_text?.[0]?.plain_text || props.Notes?.rich_text?.[0]?.plain_text || null;

          // Upsert shift (unique on cast_id + shift_date + start_time)
          const { error } = await supabase
            .from('shifts')
            .upsert({
              cast_id: castId,
              shift_date: shiftDate,
              start_time: startTime,
              end_time: endTime,
              room,
              notes,
              status: 'scheduled',
            }, {
              onConflict: 'cast_id,shift_date,start_time',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error(`Error syncing shift for ${name}:`, error);
            results.notionToDb.errors.push({ name, error: error.message });
          } else {
            results.notionToDb.synced++;
          }
        } catch (err: any) {
          results.notionToDb.errors.push({ page: page.id, error: err.message });
        }
      }
    }

    // ========== DB → Notion ==========
    if (direction === 'db-to-notion' || direction === 'both') {
      console.log('Syncing shifts from DB to Notion...');

      // Get recent/future shifts from DB
      const today = new Date().toISOString().split('T')[0];
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*, casts(name)')
        .gte('shift_date', today)
        .order('shift_date');

      if (shifts && shifts.length > 0) {
        // Get existing Notion pages for mapping (cast name → page id)
        const notionResponse = await fetch(
          `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${notionApiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 100 }),
          }
        );

        const notionData = await notionResponse.json();
        const castNameToPageId: Record<string, string> = {};

        for (const page of notionData.results) {
          const name = page.properties.名前?.title?.[0]?.plain_text 
            || page.properties.Name?.title?.[0]?.plain_text || '';
          if (name) castNameToPageId[name] = page.id;
        }

        // Group shifts by cast to update execution dates
        const shiftsByCast: Record<string, typeof shifts> = {};
        for (const shift of shifts) {
          const castName = (shift as any).casts?.name;
          if (!castName) continue;
          if (!shiftsByCast[castName]) shiftsByCast[castName] = [];
          shiftsByCast[castName].push(shift);
        }

        for (const [castName, castShifts] of Object.entries(shiftsByCast)) {
          const pageId = castNameToPageId[castName];
          if (!pageId) continue;

          // Find earliest and latest shift dates
          const dates = castShifts.map(s => s.shift_date).sort();
          const earliestDate = dates[0];
          const latestDate = dates[dates.length - 1];

          // Get start/end times from the earliest shift
          const earliestShift = castShifts.find(s => s.shift_date === earliestDate);

          try {
            const updateProps: Record<string, any> = {
              '実行日': {
                date: {
                  start: earliestDate,
                  end: latestDate !== earliestDate ? latestDate : null,
                }
              },
            };

            // Update start/end time if properties exist
            if (earliestShift) {
              updateProps['出勤時間'] = {
                rich_text: [{ text: { content: earliestShift.start_time.slice(0, 5) } }]
              };
              updateProps['退勤時間'] = {
                rich_text: [{ text: { content: earliestShift.end_time.slice(0, 5) } }]
              };
            }

            const updateResponse = await fetch(
              `https://api.notion.com/v1/pages/${pageId}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${notionApiKey}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties: updateProps }),
              }
            );

            if (!updateResponse.ok) {
              const errText = await updateResponse.text();
              console.warn(`Failed to update Notion page for ${castName}: ${errText}`);
              results.dbToNotion.errors.push({ name: castName, error: errText });
            } else {
              results.dbToNotion.synced++;
            }
          } catch (err: any) {
            results.dbToNotion.errors.push({ name: castName, error: err.message });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        direction,
        notionToDb: results.notionToDb,
        dbToNotion: results.dbToNotion,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function normalizeTime(raw: string): string {
  // Handle various time formats: "10:00", "10時", "1000", etc.
  const cleaned = raw.replace(/[時分]/g, ':').replace(/\s/g, '');
  const match = cleaned.match(/(\d{1,2}):?(\d{2})?/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2] || '00';
    return `${hours}:${minutes}:00`;
  }
  return '10:00:00';
}
