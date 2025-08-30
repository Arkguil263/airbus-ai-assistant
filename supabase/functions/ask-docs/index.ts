// supabase/functions/ask-docs/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const VECTOR_STORE_ID = Deno.env.get("OPENAI_VECTOR_STORE_ID");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { question } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return new Response(JSON.stringify({ error: "Missing 'question'." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log("=== ASK-DOCS CALLED ===");
    console.log("Question:", question);
    console.log("OPENAI_API_KEY set:", !!OPENAI_API_KEY);
    console.log("VECTOR_STORE_ID:", VECTOR_STORE_ID);

    // Use Chat Completions API instead of Responses API for more reliability
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          {
            role: "system",
            content: "You are an expert aircraft documentation assistant. Use the provided documents to give precise answers from the manuals."
          },
          {
            role: "user", 
            content: question
          }
        ],
        max_completion_tokens: 800,
        temperature: 0.3
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI API error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    console.log("OpenAI raw response:", JSON.stringify(data, null, 2));

    // Extract answer from Chat Completions response
    const answer = data?.choices?.[0]?.message?.content ?? "No relevant answer found.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-docs error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});