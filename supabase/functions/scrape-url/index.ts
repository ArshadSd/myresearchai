import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic safety check
    const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".gq"];
    const isSuspiciousTLD = suspiciousTLDs.some((tld) => parsedUrl.hostname.endsWith(tld));
    const hasIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsedUrl.hostname);
    const hasExcessiveSubdomains = parsedUrl.hostname.split(".").length > 4;
    const hasDeceptiveChars = /[а-яА-Я]/.test(parsedUrl.hostname);

    let safetyScore = 100;
    const safetyFlags: string[] = [];
    if (isSuspiciousTLD) { safetyScore -= 30; safetyFlags.push("Suspicious TLD"); }
    if (hasIPAddress) { safetyScore -= 25; safetyFlags.push("IP address instead of domain"); }
    if (hasExcessiveSubdomains) { safetyScore -= 20; safetyFlags.push("Excessive subdomains"); }
    if (hasDeceptiveChars) { safetyScore -= 30; safetyFlags.push("Deceptive characters in URL"); }
    if (!parsedUrl.protocol.startsWith("https")) { safetyScore -= 15; safetyFlags.push("Not using HTTPS"); }

    const safetyLevel = safetyScore >= 80 ? "safe" : safetyScore >= 50 ? "caution" : "danger";
    const safety = { score: safetyScore, level: safetyLevel, flags: safetyFlags };

    // Try fetching with multiple User-Agent strategies to handle bot-blocking (418, 403, etc.)
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ];

    let response: Response | null = null;
    let lastStatus = 0;

    for (const ua of userAgents) {
      try {
        const res = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
          },
          redirect: "follow",
        });
        lastStatus = res.status;
        if (res.ok) {
          response = res;
          break;
        }
        // Consume body to free connection
        await res.text();
      } catch {
        continue;
      }
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `This website blocked our request (HTTP ${lastStatus || "unknown"}). Some sites like IEEE, ScienceDirect, and other publishers restrict automated access. Try copying the article text and pasting it directly into the chat instead.`,
          safety,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : parsedUrl.hostname;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    // Remove script, style, nav, footer, header tags
    let cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "");

    // Extract text from remaining HTML
    const text = cleanHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not extract meaningful content from this page. The site may require login or use JavaScript rendering. Try copying the text and pasting it directly into the chat.",
          safety,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        title,
        description,
        text: text.slice(0, 80000),
        url: parsedUrl.toString(),
        safety,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scrape-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Failed to scrape URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
