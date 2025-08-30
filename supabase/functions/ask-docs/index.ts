import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_REALTIME_API_KEY")!;
const VECTOR_STORE_ID = Deno.env.get("OPENAI_VECTOR_STORE_ID")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { question } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing 'question'." }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    console.log('Searching docs for question:', question);
    console.log('Using vector store ID:', VECTOR_STORE_ID);

    // Try the Responses API instead of Chat Completions for file search
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        input: question,
        instructions: "You are an expert aircraft documentation assistant specializing in aviation technical manuals, procedures, and regulations. Use the provided documents to give precise, actionable answers about aircraft systems, maintenance procedures, flight operations, and safety protocols. Always cite specific document sections when available and be concise but thorough.",
        tools: [{ type: "file_search" }],
        tool_choice: "auto",
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID]
          }
        },
        max_completion_tokens: 1000
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('OpenAI API error:', err);
      return new Response(JSON.stringify({ error: err }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    const json = await resp.json();
    console.log('Received response from OpenAI:', JSON.stringify(json, null, 2));

    // Handle Responses API format
    const answer = json?.output_text || json?.choices?.[0]?.message?.content || "I couldn't find relevant information in the documentation for your question.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('Error in ask-docs:', e);
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500, 
      headers: { ...cors, "Content-Type": "application/json" } 
    });
  }
});