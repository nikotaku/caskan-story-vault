import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = { "Content-Type": "application/json" };

const secureEqual = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

Deno.serve(async (request: Request) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secureEqual(request.headers.get("apikey") || "", serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const payload = await request.json() as { message?: unknown };
    if (typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 5_000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: jsonHeaders });
    }

    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("LINE_GROUP_ID");
    if (!token || !groupId) throw new Error("LINE credentials are not configured");

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: payload.message }],
      }),
    });
    const detail = await lineResponse.text();
    if (!lineResponse.ok) {
      throw new Error(`LINE API failed (${lineResponse.status}): ${detail.slice(0, 300)}`);
    }
    return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
