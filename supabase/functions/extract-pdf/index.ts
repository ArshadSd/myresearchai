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

    // Simple PDF text extraction - find text between BT and ET markers,
    // and also extract text from stream objects
    let extractedText = "";

    // Convert to string for parsing
    const decoder = new TextDecoder("latin1");
    const pdfContent = decoder.decode(bytes);

    // Method 1: Extract text between parentheses in BT...ET blocks
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(pdfContent)) !== null) {
      const block = match[1];
      // Extract text in parentheses (Tj and TJ operators)
      const textRegex = /\(([^)]*)\)/g;
      let textMatch;
      while ((textMatch = textRegex.exec(block)) !== null) {
        const decoded = textMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"');
        extractedText += decoded;
      }
      extractedText += "\n";
    }

    // Method 2: If no text found, try to find readable ASCII sequences
    if (extractedText.trim().length < 50) {
      const asciiRegex = /[\x20-\x7E]{20,}/g;
      const asciiMatches = pdfContent.match(asciiRegex) || [];
      const filtered = asciiMatches.filter(
        (s) => !s.includes("/") && !s.includes("<<") && !s.startsWith("stream")
      );
      if (filtered.length > 0) {
        extractedText = filtered.join("\n");
      }
    }

    // Clean up
    extractedText = extractedText
      .replace(/\x00/g, "")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!extractedText || extractedText.length < 10) {
      // Use AI to describe what we found
      extractedText = `[PDF uploaded: ${file.name}, ${(file.size / 1024).toFixed(1)}KB. Text extraction produced limited results - this PDF may contain scanned images. You can still ask questions and I'll do my best to help based on the file metadata.]`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText.slice(0, 100000), // Cap at 100k chars
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
