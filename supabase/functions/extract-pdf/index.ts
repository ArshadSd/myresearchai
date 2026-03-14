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

    // ── Strategy 1: Use AI (Gemini) to read the PDF natively as a document ──
    // Gemini supports inline PDF via multimodal — this gives the best results
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let extractedText = "";

    if (LOVABLE_API_KEY) {
      // Convert PDF bytes to base64
      const base64Pdf = btoa(String.fromCharCode(...bytes));

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
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Please extract ALL text content from this PDF document. Output ONLY the extracted text content in a clean, readable format. Preserve headings, paragraphs, lists, tables and their structure. Do NOT describe the PDF structure or metadata — only output the actual text content that a reader would see.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`,
                    },
                  },
                ],
              },
            ],
            stream: false,
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const aiText = aiData.choices?.[0]?.message?.content ?? "";
          if (aiText.length > 50) {
            extractedText = aiText;
          }
        } else {
          const errText = await aiResp.text();
          console.error("AI extraction error:", aiResp.status, errText);
        }
      } catch (aiErr) {
        console.error("AI extraction threw:", aiErr);
      }
    }

    // ── Strategy 2: Fallback regex-based extraction if AI fails ──
    if (extractedText.trim().length < 50) {
      const decoder = new TextDecoder("latin1");
      const pdfContent = decoder.decode(bytes);

      let fallback = "";

      // BT...ET blocks with Tj / TJ operators
      const btEtRegex = /BT\s([\s\S]*?)ET/g;
      let match;
      while ((match = btEtRegex.exec(pdfContent)) !== null) {
        const block = match[1];
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let m;
        while ((m = tjRegex.exec(block)) !== null) fallback += decodeOctal(m[1]) + " ";
        const tjArrRegex = /\[([^\]]*)\]\s*TJ/g;
        while ((m = tjArrRegex.exec(block)) !== null) {
          const sR = /\(([^)]*)\)/g;
          let sm;
          while ((sm = sR.exec(m[1])) !== null) fallback += decodeOctal(sm[1]);
          fallback += " ";
        }
        if (/T[Dd*]/.test(block)) fallback += "\n";
      }

      // ASCII sequence fallback
      if (fallback.trim().length < 50) {
        const asciiMatches = pdfContent.match(/[\x20-\x7E]{20,}/g) || [];
        const filtered = asciiMatches.filter(
          (s) => !s.includes("/") && !s.includes("<<") && !s.startsWith("stream") && !s.startsWith("%PDF") && !/^[0-9\s.]+$/.test(s)
        );
        fallback = filtered.join("\n");
      }

      fallback = fallback.replace(/\x00/g, "").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (fallback.length > 50) extractedText = fallback;
    }

    if (!extractedText || extractedText.length < 10) {
      extractedText = `[PDF uploaded: ${file.name}, ${(file.size / 1024).toFixed(1)}KB. Text extraction produced limited results — this PDF may be scanned/image-based or password-protected. You can still ask questions and I will do my best to analyze the file.]`;
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

function decodeOctal(s: string): string {
  return s
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\").replace(/\\'/g, "'").replace(/\\"/g, '"');
}
