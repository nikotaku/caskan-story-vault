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
    const { pageId, slug } = await req.json();
    
    if (!pageId || !slug) {
      throw new Error('pageId and slug are required');
    }

    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!notionApiKey) {
      throw new Error('Notion API key not configured');
    }

    console.log(`Fetching Notion page: ${pageId}`);

    // Fetch page properties
    const pageResponse = await fetch(
      `https://api.notion.com/v1/pages/${pageId}`,
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!pageResponse.ok) {
      const errorText = await pageResponse.text();
      console.error('Notion API error (page):', errorText);
      throw new Error(`Notion API error: ${pageResponse.status}`);
    }

    const pageData = await pageResponse.json();

    // Fetch page content (blocks)
    const blocksResponse = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children`,
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!blocksResponse.ok) {
      const errorText = await blocksResponse.text();
      console.error('Notion API error (blocks):', errorText);
      throw new Error(`Notion API error: ${blocksResponse.status}`);
    }

    const blocksData = await blocksResponse.json();

    // Extract title
    const titleProperty = pageData.properties?.title || pageData.properties?.Title || pageData.properties?.名前;
    let title = 'Untitled';
    if (titleProperty?.title?.[0]?.plain_text) {
      title = titleProperty.title[0].plain_text;
    }

    // Convert blocks to a simpler format
    const content = {
      blocks: blocksData.results.map((block: any) => ({
        type: block.type,
        id: block.id,
        content: extractBlockContent(block),
      })),
    };

    // Save to Supabase
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    const { data, error } = await supabase
      .from('notion_pages')
      .upsert({
        notion_page_id: pageId,
        title,
        content,
        slug,
      }, {
        onConflict: 'notion_page_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }

    console.log(`Successfully synced page: ${title}`);

    return new Response(
      JSON.stringify({
        success: true,
        page: data,
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

function extractBlockContent(block: any): any {
  const type = block.type;
  const blockContent = block[type];
  
  if (!blockContent) return null;

  // Extract text content
  if (blockContent.rich_text) {
    return {
      text: blockContent.rich_text.map((t: any) => t.plain_text).join(''),
      richText: blockContent.rich_text,
    };
  }

  // Extract other content types
  switch (type) {
    case 'image':
      return {
        url: blockContent.file?.url || blockContent.external?.url,
        caption: blockContent.caption?.map((t: any) => t.plain_text).join(''),
      };
    case 'video':
      return {
        url: blockContent.external?.url || blockContent.file?.url,
      };
    case 'file':
      return {
        url: blockContent.file?.url || blockContent.external?.url,
        name: blockContent.caption?.map((t: any) => t.plain_text).join(''),
      };
    case 'bookmark':
      return {
        url: blockContent.url,
      };
    default:
      return blockContent;
  }
}