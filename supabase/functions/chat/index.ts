import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 100_000; // 100KB per message
const MAX_DOCUMENT_CONTEXT = 200_000; // 200KB

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

    const body = await req.json();
    const { messages, documentContext } = body;

    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Too many messages. Maximum ${MAX_MESSAGES} allowed.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const msg of messages) {
      if (!msg.role || typeof msg.role !== "string" || !["user", "assistant", "system"].includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Invalid message role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content !== "string" || msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: "Message content too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (documentContext !== undefined && documentContext !== null) {
      if (typeof documentContext !== "string" || documentContext.length > MAX_DOCUMENT_CONTEXT) {
        return new Response(JSON.stringify({ error: "Document context too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    // Fetch feedback stats
    const userId = data.claims.sub;
    const { data: feedbackStats } = await supabase
      .from("feedback")
      .select("helpful, message_content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    let feedbackGuidance = "";
    if (feedbackStats && feedbackStats.length >= 3) {
      const total = feedbackStats.length;
      const helpful = feedbackStats.filter((f: any) => f.helpful).length;
      const ratio = helpful / total;

      const badExamples = feedbackStats
        .filter((f: any) => !f.helpful && f.message_content && f.message_content.trim().length > 20)
        .slice(0, 5)
        .map((f: any, i: number) => `Example ${i + 1}: "${f.message_content.slice(0, 300)}"`)
        .join("\n");

      if (ratio < 0.5) {
        feedbackGuidance = `\n\nIMPORTANT — FEEDBACK IMPROVEMENT REQUIRED: ${Math.round((1 - ratio) * 100)}% of your recent responses were rated unhelpful. You must improve significantly.\n\nPrevious responses the user found unhelpful:\n${badExamples || "(none recorded)"}\n\nLearn from these examples. Fix by: (1) directly answering the question first before any context, (2) being more precise and citing specific sections from the document, (3) using bullet points and tables for clarity, (4) avoiding vague or generic statements that don't address the user's specific question.`;
      } else if (ratio >= 0.8) {
        feedbackGuidance = "\n\nNote: Users are finding your responses very helpful. Continue your current approach — thorough, well-structured, and specific.";
      } else {
        feedbackGuidance = `\n\nNote: Some responses could be improved. Be more direct and specific.\n${badExamples ? `Recent unhelpful responses to avoid repeating:\n${badExamples}` : ""}`;
      }
    }

    const basePrompt = documentContext
      ? `You are an expert AI Research Assistant specialized in academic paper analysis. You have been given the following document to analyze:\n\n---DOCUMENT START---\n${documentContext}\n---DOCUMENT END---\n\nCRITICAL INSTRUCTIONS:\n1. Extract ONLY academic content: algorithms, technologies, evaluation metrics, experimental results, and key technical observations.\n2. DO NOT mention anything about the PDF file, formatting, similarity reports, submission reports, page numbers, or document metadata.\n3. DO NOT include HTML tags, markdown formatting labels, or meta-commentary about the document structure.\n4. DO NOT discuss differences between file versions.\n5. Base ALL answers strictly on the document content above — never guess or hallucinate.\n6. If a specific fact is NOT in the document, explicitly state "This is not mentioned in the document."\n7. When asked to analyze or summarize the paper, ALWAYS respond using this exact output format:\n\n## Algorithms & Technology Stack\n(Explain the models, tools, frameworks, and algorithms used)\n\n## Evaluation Metrics\n(List and explain each metric used to evaluate the system)\n\n## Experimental Results\n(Provide exact numerical results, benchmarks, and findings from the paper)\n\n## Key Technical Observations\n(Important technical insights, limitations, or conclusions mentioned in the paper)\n\nEnsure the response is clean academic content suitable for direct inclusion in a report.`
      : `You are an expert AI Research Assistant. You help users with research tasks: analyzing academic papers, answering questions precisely, summarizing content, comparing papers, and generating insights. Be thorough, well-structured, and always cite sources when available. Use headings, bullet points, and clear formatting.`;

    const systemPrompt = basePrompt + feedbackGuidance;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
