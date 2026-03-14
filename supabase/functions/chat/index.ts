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

    const { messages, documentContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch feedback stats + negative examples to dynamically adjust system prompt
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

      // Collect the most recent negative-feedback message samples to learn from
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
      ? `You are an expert AI Research Assistant. You help users analyze, summarize, and extract insights from research documents. You have been provided with the following document content to analyze:\n\n---\n${documentContext}\n---\n\nAnswer the user's questions based on this document. If the question is outside the document scope, let the user know and offer general assistance. Be thorough, cite relevant sections, and structure your responses clearly with headings and bullet points when appropriate.`
      : `You are an expert AI Research Assistant. You help users with research tasks including analyzing documents, answering questions, summarizing content, comparing papers, and generating insights. Be thorough, well-structured, and cite sources when available. Use headings, bullet points, and clear formatting in your responses.`;

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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
