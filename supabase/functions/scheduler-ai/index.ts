import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SUBJECT_LENGTH = 200;
const MAX_TOPICS_LENGTH = 2000;
const MAX_DAY_CONTENT_LENGTH = 50_000;
const MAX_TOTAL_DAYS = 365;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
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
    const { action, subject, topics, totalDays, dayNumber, dayContent } = body;

    // Validate action
    if (!action || !["generate-day", "generate-quiz"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    if (action === "generate-day") {
      // Validate inputs
      if (!subject || typeof subject !== "string" || subject.length > MAX_SUBJECT_LENGTH) {
        return new Response(JSON.stringify({ error: "Invalid subject" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (topics && (typeof topics !== "string" || topics.length > MAX_TOPICS_LENGTH)) {
        return new Response(JSON.stringify({ error: "Topics too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!dayNumber || typeof dayNumber !== "number" || dayNumber < 1 || dayNumber > MAX_TOTAL_DAYS) {
        return new Response(JSON.stringify({ error: "Invalid day number" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!totalDays || typeof totalDays !== "number" || totalDays < 1 || totalDays > MAX_TOTAL_DAYS) {
        return new Response(JSON.stringify({ error: "Invalid total days" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prompt = `You are an expert study planner. Generate a focused, structured study plan for Day ${dayNumber} of ${totalDays}.

Subject: ${subject}
${topics ? `Topics/Syllabus: ${topics}` : ""}
Day: ${dayNumber} of ${totalDays}

Generate a complete day's study content in this EXACT JSON format:
{
  "title": "Concise day title (max 8 words)",
  "focus": "The single core concept/skill for today",
  "content": "Detailed study content (500-800 words). Use structured sections with headers like ## Section, bullet points, examples. Make it educational and comprehensive.",
  "outcomes": ["Learning outcome 1", "Learning outcome 2", "Learning outcome 3"],
  "estimatedMinutes": 45
}

Rules:
- Day 1 covers fundamentals, later days go deeper
- Content must be specific to the subject, not generic
- Outcomes should be measurable ("You will be able to...")
- Distribute topics evenly across ${totalDays} days
- Return ONLY valid JSON, no markdown code blocks`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert educational content creator. Always respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service error");
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate-quiz") {
      // Validate inputs
      if (!subject || typeof subject !== "string" || subject.length > MAX_SUBJECT_LENGTH) {
        return new Response(JSON.stringify({ error: "Invalid subject" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!dayContent || typeof dayContent !== "string" || dayContent.length > MAX_DAY_CONTENT_LENGTH) {
        return new Response(JSON.stringify({ error: "Invalid day content" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prompt = `Based on the following study content, generate exactly 5 multiple-choice questions to test understanding.

Subject: ${subject}
Day Content: ${dayContent}

Generate questions in this EXACT JSON format:
{
  "questions": [
    {
      "question": "Clear, specific question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- Questions must test UNDERSTANDING, not just memory
- Mix difficulty: 2 easy, 2 medium, 1 hard
- Options must be plausible (no obviously wrong answers)
- correct_answer is the 0-indexed position in options array
- Return ONLY valid JSON, no markdown`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert quiz creator. Always respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI service error");
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("scheduler-ai error:", e);
    return new Response(JSON.stringify({ error: "An error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
