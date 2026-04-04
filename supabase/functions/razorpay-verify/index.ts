import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billing_cycle, is_trial } = await req.json();

    // For trials, skip signature verification
    if (!is_trial) {
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
      const expectedSig = await hmacSha256(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
      
      if (expectedSig !== razorpay_signature) {
        return new Response(JSON.stringify({ error: "Invalid payment signature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    let periodEnd: Date;
    let trialEndsAt: Date | null = null;

    if (is_trial) {
      trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      periodEnd = trialEndsAt;
    } else if (billing_cycle === "yearly") {
      periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const { error: subErr } = await adminClient.from("subscriptions").upsert({
      user_id: user.id,
      plan,
      billing_cycle,
      razorpay_payment_id,
      status: is_trial ? "trialing" : "active",
      trial_ends_at: trialEndsAt?.toISOString() || null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

    if (subErr) {
      return new Response(JSON.stringify({ error: "Failed to update subscription" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, plan, status: is_trial ? "trialing" : "active" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
