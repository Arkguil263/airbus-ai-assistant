import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_REALTIME_API_KEY")!;
const REALTIME_MODEL = Deno.env.get("OPENAI_REALTIME_MODEL") ?? "gpt-4o-realtime-preview-2024-12-17";
const REALTIME_VOICE = Deno.env.get("OPENAI_REALTIME_VOICE") ?? "alloy";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const { instructions } = body;

    console.log('Creating realtime session with model:', REALTIME_MODEL);

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        instructions: instructions ?? "You are a helpful voice agent for aircraft documentation. Keep replies concise and friendly. When users ask about aircraft systems or documentation, I will provide you with relevant information to help answer their questions.",
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
    console.log('Session created successfully');
    
    return new Response(JSON.stringify(json), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('Error creating session:', e);
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500, 
      headers: { ...cors, "Content-Type": "application/json" } 
    });
  }
});