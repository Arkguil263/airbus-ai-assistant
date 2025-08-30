import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const VECTOR_STORE_ID = Deno.env.get("OPENAI_VECTOR_STORE_ID")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    console.log('=== ASK-DOCS FUNCTION CALLED ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const body = await req.json();
    console.log('Request body:', body);
    const { question } = body;

    if (!question) {
      console.log('ERROR: Missing question in request');
      return new Response(JSON.stringify({ error: "Missing 'question'." }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    console.log('=== ENVIRONMENT CHECK ===');
    console.log('OPENAI_API_KEY available:', !!OPENAI_API_KEY);
    console.log('VECTOR_STORE_ID available:', !!VECTOR_STORE_ID);
    console.log('VECTOR_STORE_ID value:', VECTOR_STORE_ID);

    console.log('=== PROCESSING QUESTION ===');
    console.log('Question:', question);

    console.log('=== CALLING OPENAI API ===');
    // Try the Responses API instead of Chat Completions for file search
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-2025-08-07",
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

    console.log('OpenAI response status:', resp.status);
    console.log('OpenAI response headers:', Object.fromEntries(resp.headers.entries()));

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