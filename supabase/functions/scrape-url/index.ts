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

    // Validate URL format
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
    const hasDeceptiveChars = /[а-яА-Я]/.test(parsedUrl.hostname); // Cyrillic lookalikes

    let safetyScore = 100;
    const safetyFlags: string[] = [];
    if (isSuspiciousTLD) { safetyScore -= 30; safetyFlags.push("Suspicious TLD"); }
    if (hasIPAddress) { safetyScore -= 25; safetyFlags.push("IP address instead of domain"); }
    if (hasExcessiveSubdomains) { safetyScore -= 20; safetyFlags.push("Excessive subdomains"); }
    if (hasDeceptiveChars) { safetyScore -= 30; safetyFlags.push("Deceptive characters in URL"); }
    if (!parsedUrl.protocol.startsWith("https")) { safetyScore -= 15; safetyFlags.push("Not using HTTPS"); }

    const safetyLevel = safetyScore >= 80 ? "safe" : safetyScore >= 50 ? "caution" : "danger";

    // Fetch and extract content
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Failed to fetch URL (${response.status})`,
          safety: { score: safetyScore, level: safetyLevel, flags: safetyFlags },
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

    return new Response(
      JSON.stringify({
        success: true,
        title,
        description,
        text: text.slice(0, 80000),
        url: parsedUrl.toString(),
        safety: {
          score: safetyScore,
          level: safetyLevel,
          flags: safetyFlags,
        },
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
