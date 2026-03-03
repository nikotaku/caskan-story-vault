import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// 出勤日DB ID (related database from the cast DB)
const SHIFT_DB_ID = '256f9507-f0cf-8076-931f-ed70fc040520';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!notionApiKey) {
      throw new Error('Notion API key not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const body = await req.json().catch(() => ({}));
    const direction = body.direction || 'both';

    const results = {
      notionToDb: { synced: 0, skipped: 0, errors: [] as any[] },
      dbToNotion: { synced: 0, errors: [] as any[] },
    };

    // Get cast name→id mapping
    const { data: casts } = await supabase.from('casts').select('id, name');
    const castNameToId: Record<string, string> = {};
    const castIdToName: Record<string, string> = {};
    for (const cast of (casts || [])) {
      castNameToId[cast.name] = cast.id;
      castIdToName[cast.id] = cast.name;
    }

    // ========== Notion → DB ==========
    if (direction === 'notion-to-db' || direction === 'both') {
      console.log('Syncing shifts from Notion 出勤日DB to shifts table...');

      let allPages: any[] = [];
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
        const response = await fetch(
          `https://api.notion.com/v1/databases/${SHIFT_DB_ID}/query`,
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

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Notion API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        allPages = allPages.concat(data.results);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }

      console.log(`Found ${allPages.length} shift entries in Notion`);

      for (const page of allPages) {
        try {
          const props = page.properties;

          // タイトル = キャスト名
          const castName = props['タイトル']?.title?.[0]?.plain_text?.trim() || '';
          if (!castName) {
            results.notionToDb.skipped++;
            continue;
          }

          const castId = castNameToId[castName];
          if (!castId) {
            // Try partial match
            const matchedName = Object.keys(castNameToId).find(
              n => n.includes(castName) || castName.includes(n)
            );
            if (!matchedName) {
              console.warn(`Cast not found: ${castName}`);
              results.notionToDb.skipped++;
              continue;
            }
          }

          const finalCastId = castId || castNameToId[
            Object.keys(castNameToId).find(
              n => n.includes(castName) || castName.includes(n)
            )!
          ];

          if (!finalCastId) {
            results.notionToDb.skipped++;
            continue;
          }

          // 日付 = シフト日付
          const dateField = props['日付']?.date;
          if (!dateField?.start) {
            results.notionToDb.skipped++;
            continue;
          }

          // Parse date - may include time (e.g., "2026-02-06T11:00:00.000+00:00")
          const startStr = dateField.start;
          const shiftDate = startStr.split('T')[0];

          // 条件 = シフト条件テキスト (例: "出勤 13", "前乗り 20:00", "11")
          const conditionText = props['条件']?.rich_text?.[0]?.plain_text?.trim() || '';

          // Parse start/end time from 条件 text and 日付
          const { startTime, endTime } = parseShiftTimes(conditionText, startStr);

          // ルーム
          const room = props['ルーム']?.select?.name || null;

          // ｼﾌﾄﾁｪｯｸ status as notes
          const shiftCheck = props['ｼﾌﾄﾁｪｯｸ']?.status?.name || '';
          const notes = conditionText ? `${conditionText}${shiftCheck ? ` [${shiftCheck}]` : ''}` : (shiftCheck || null);

          // Upsert shift
          const { error } = await supabase
            .from('shifts')
            .upsert({
              cast_id: finalCastId,
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
            console.error(`Error syncing shift for ${castName}:`, error);
            results.notionToDb.errors.push({ name: castName, error: error.message });
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
      console.log('Syncing shifts from DB to Notion 出勤日DB...');

      // Get future shifts from DB
      const today = new Date().toISOString().split('T')[0];
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*')
        .gte('shift_date', today)
        .order('shift_date');

      if (shifts && shifts.length > 0) {
        // Get existing Notion shift pages for dedup (by cast name + date)
        let existingPages: any[] = [];
        let hasMore = true;
        let startCursor: string | undefined;

        while (hasMore) {
          const response = await fetch(
            `https://api.notion.com/v1/databases/${SHIFT_DB_ID}/query`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                page_size: 100,
                filter: {
                  property: '日付',
                  date: { on_or_after: today },
                },
                ...(startCursor ? { start_cursor: startCursor } : {}),
              }),
            }
          );

          if (!response.ok) break;
          const data = await response.json();
          existingPages = existingPages.concat(data.results);
          hasMore = data.has_more;
          startCursor = data.next_cursor;
        }

        // Build set of existing (name+date) combos
        const existingSet = new Set<string>();
        for (const page of existingPages) {
          const name = page.properties['タイトル']?.title?.[0]?.plain_text?.trim() || '';
          const date = page.properties['日付']?.date?.start?.split('T')[0] || '';
          if (name && date) existingSet.add(`${name}|${date}`);
        }

        // Create missing shifts in Notion
        for (const shift of shifts) {
          const castName = castIdToName[shift.cast_id];
          if (!castName) continue;

          const key = `${castName}|${shift.shift_date}`;
          if (existingSet.has(key)) continue; // Already exists

          try {
            const createResponse = await fetch(
              `https://api.notion.com/v1/pages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${notionApiKey}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  parent: { database_id: SHIFT_DB_ID },
                  properties: {
                    'タイトル': {
                      title: [{ text: { content: castName } }],
                    },
                    '日付': {
                      date: { start: shift.shift_date },
                    },
                    '条件': {
                      rich_text: [{
                        text: {
                          content: `出勤 ${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`,
                        },
                      }],
                    },
                    ...(shift.room ? {
                      'ルーム': {
                        select: { name: shift.room },
                      },
                    } : {}),
                  },
                }),
              }
            );

            if (!createResponse.ok) {
              const errText = await createResponse.text();
              results.dbToNotion.errors.push({ name: castName, error: errText });
            } else {
              results.dbToNotion.synced++;
              existingSet.add(key); // Prevent duplicates in same run
            }
          } catch (err: any) {
            results.dbToNotion.errors.push({ name: castName, error: err.message });
          }
        }
      }
    }

    console.log(`Sync complete: Notion→DB: ${results.notionToDb.synced} synced, ${results.notionToDb.skipped} skipped, ${results.notionToDb.errors.length} errors | DB→Notion: ${results.dbToNotion.synced} synced, ${results.dbToNotion.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        direction,
        ...results,
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

/**
 * Parse shift start/end times from the 条件 text and date string.
 * 
 * Examples of 条件 text:
 * - "出勤 13" → start at 13:00, end at 翌日 (default 22:00)
 * - "前乗り 20:00" → start at 20:00
 * - "11" → start at 11:00
 * - "出勤 13:00-22:00" → start 13:00, end 22:00
 * 
 * If the date string contains time (e.g., "2026-02-06T11:00:00.000+00:00"),
 * use that as start time.
 */
function parseShiftTimes(
  conditionText: string,
  dateStr: string
): { startTime: string; endTime: string } {
  let startTime = '10:00:00';
  let endTime = '22:00:00';

  // First, try to get time from the date string itself
  if (dateStr.includes('T')) {
    const timePart = dateStr.split('T')[1];
    const match = timePart.match(/(\d{2}):(\d{2})/);
    if (match) {
      startTime = `${match[1]}:${match[2]}:00`;
    }
  }

  // Then parse 条件 text for more specific times
  if (conditionText) {
    // Try to find time range pattern: "13:00-22:00" or "13-22"
    const rangeMatch = conditionText.match(/(\d{1,2}):?(\d{2})?\s*[-~]\s*(\d{1,2}):?(\d{2})?/);
    if (rangeMatch) {
      startTime = normalizeHour(rangeMatch[1], rangeMatch[2]);
      endTime = normalizeHour(rangeMatch[3], rangeMatch[4]);
    } else {
      // Try to find single time: "出勤 13" or "13:00" or just "11"
      const timeMatch = conditionText.match(/(\d{1,2}):?(\d{2})?/);
      if (timeMatch) {
        startTime = normalizeHour(timeMatch[1], timeMatch[2]);
      }
    }
  }

  return { startTime, endTime };
}

/**
 * Normalize hours that exceed 23 (e.g., 25時 = 翌1時, 50 = ignore/default).
 * In Japan's entertainment industry, times after midnight are often written as 25:00 (= 1:00 AM).
 */
function normalizeHour(hourStr: string, minuteStr?: string): string {
  let hours = parseInt(hourStr, 10);
  const minutes = minuteStr || '00';

  if (hours >= 24 && hours < 48) {
    hours = hours - 24;
  } else if (hours >= 48) {
    // Likely invalid (e.g., "50"), default to a reasonable time
    return '10:00:00';
  }

  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}
