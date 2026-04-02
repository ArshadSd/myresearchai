import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Use service role to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Find shared chat
    const { data: shared } = await adminClient.from("shared_chats").select("*").eq("token", token).maybeSingle();
    if (!shared) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get original conversation
    const { data: origConv } = await adminClient.from("conversations").select("*").eq("id", shared.conversation_id).maybeSingle();
    if (!origConv) return new Response(JSON.stringify({ error: "Original chat no longer exists" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Create new conversation for the importing user
    const { data: newConv, error: convErr } = await adminClient.from("conversations").insert({
      user_id: user.id,
      title: `📥 ${origConv.title}`,
    }).select().single();
    if (convErr) return new Response(JSON.stringify({ error: "Failed to create chat" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Copy messages
    const { data: origMessages } = await adminClient.from("messages").select("role, content").eq("conversation_id", shared.conversation_id).order("created_at", { ascending: true });
    if (origMessages && origMessages.length > 0) {
      await adminClient.from("messages").insert(
        origMessages.map((m: any) => ({ conversation_id: newConv.id, user_id: user.id, role: m.role, content: m.content }))
      );
    }

    return new Response(JSON.stringify({ conversation: newConv, messageCount: origMessages?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
