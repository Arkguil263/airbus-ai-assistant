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
    const { question } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Missing 'question'." }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" } 
      });
    }

    console.log('Searching docs for question:', question);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert aircraft documentation assistant. Use the provided documents to answer questions about aircraft systems, procedures, and technical information. Always cite specific sources when available."
          },
          {
            role: "user",
            content: question
          }
        ],
        tools: [{ type: "file_search" }],
        tool_choice: "auto",
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID]
          }
        },
        max_tokens: 1000,
        temperature: 0.1
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
    console.log('Received response from OpenAI');

    const answer = json.choices?.[0]?.message?.content || "No answer found.";

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