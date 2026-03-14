import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > 30 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum 30MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to string for parsing
    const decoder = new TextDecoder("latin1");
    const pdfContent = decoder.decode(bytes);

    // ── Method 1: Extract text from BT...ET blocks (standard PDF text objects) ──
    let extractedText = "";
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(pdfContent)) !== null) {
      const block = match[1];
      // Handle Tj (single string) operator
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        extractedText += decodeOctal(tjMatch[1]) + " ";
      }
      // Handle TJ (array of strings) operator — handles kerning pairs
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
      let arrMatch;
      while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = arrMatch[1];
        const strRegex = /\(([^)]*)\)/g;
        let sMatch;
        while ((sMatch = strRegex.exec(inner)) !== null) {
          extractedText += decodeOctal(sMatch[1]);
        }
        extractedText += " ";
      }
      // Handle TD / T* / Td operators as line breaks
      if (/T[Dd*]/.test(block)) extractedText += "\n";
    }

    // ── Method 2: Extract from streams that contain readable text ──
    if (extractedText.trim().length < 100) {
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let streamMatch;
      while ((streamMatch = streamRegex.exec(pdfContent)) !== null) {
        const streamContent = streamMatch[1];
        // Only process if stream looks like it has text operators (not compressed)
        if (/BT|Tj|TJ/.test(streamContent)) {
          const btBlocks = streamContent.match(/BT[\s\S]*?ET/g) || [];
          for (const block of btBlocks) {
            const tjR = /\(([^)]*)\)\s*Tj/g;
            let m;
            while ((m = tjR.exec(block)) !== null) extractedText += decodeOctal(m[1]) + " ";
            const tjAR = /\[([^\]]*)\]\s*TJ/g;
            while ((m = tjAR.exec(block)) !== null) {
              const sR = /\(([^)]*)\)/g;
              let sm;
              while ((sm = sR.exec(m[1])) !== null) extractedText += decodeOctal(sm[1]);
              extractedText += " ";
            }
          }
        }
      }
    }

    // ── Method 3: Fallback — readable ASCII sequences ──
    if (extractedText.trim().length < 50) {
      const asciiRegex = /[\x20-\x7E]{20,}/g;
      const asciiMatches = pdfContent.match(asciiRegex) || [];
      const filtered = asciiMatches.filter(
        (s) =>
          !s.includes("/") &&
          !s.includes("<<") &&
          !s.startsWith("stream") &&
          !s.startsWith("%PDF") &&
          !/^[0-9\s.]+$/.test(s)
      );
      if (filtered.length > 0) {
        extractedText = filtered.join("\n");
      }
    }

    // ── Clean up ──
    extractedText = extractedText
      .replace(/\x00/g, "")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/[ \t]{3,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n")
      .trim();

    const hasGoodText = extractedText.length >= 100 && /[a-zA-Z]{3,}/.test(extractedText);

    // ── Method 4: If still poor, use AI to read the raw content ──
    if (!hasGoodText) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Send a sample of the raw PDF for AI-assisted extraction
        const rawSample = pdfContent.slice(0, 60000);
        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a PDF text extractor. The user will provide raw PDF byte content (latin1-decoded). Extract ALL readable text from it, preserving the logical reading order, headings, paragraphs and lists. Output ONLY the extracted text — no commentary, no preamble.",
                },
                {
                  role: "user",
                  content: `Extract all readable text from this PDF content:\n\n${rawSample}`,
                },
              ],
              stream: false,
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const aiText = aiData.choices?.[0]?.message?.content || "";
            if (aiText.length > 50) {
              extractedText = aiText;
            }
          }
        } catch (_e) {
          // AI fallback failed, continue with what we have
        }
      }
    }

    if (!extractedText || extractedText.length < 10) {
      extractedText = `[PDF uploaded: ${file.name}, ${(file.size / 1024).toFixed(1)}KB. Text extraction produced limited results — this PDF may be scanned/image-based. You can still ask questions and I will describe what I can infer from the file metadata.]`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText.slice(0, 120000),
        fileName: file.name,
        fileSize: file.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Failed to extract PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Decode PDF octal escape sequences like \101 → 'A' */
function decodeOctal(s: string): string {
  return s
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
}
