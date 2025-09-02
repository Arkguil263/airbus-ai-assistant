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
    const { instructions, aircraftModel } = body;

    console.log('Creating realtime session with model:', REALTIME_MODEL, 'for aircraft:', aircraftModel);

    // Get vector store ID based on aircraft model
    const getVectorStoreId = (model: string) => {
      switch (model) {
        case 'A320':
          return Deno.env.get("OPENAI_A320_VECTOR_STORE_ID");
        case 'A330':
          return Deno.env.get("OPENAI_A330_VECTOR_STORE_ID");
        case 'A350':
          return Deno.env.get("OPENAI_A350_VECTOR_STORE_ID");
        case 'Briefing':
          return Deno.env.get("OPENAI_BRIEFING_VECTOR_STORE_ID");
        default:
          return null;
      }
    };

    const vectorStoreId = getVectorStoreId(aircraftModel);
    console.log(`Vector store ID for ${aircraftModel}:`, vectorStoreId?.substring(0, 8) + '...');

    // Enhanced instructions with citation requirements
    const enhancedInstructions = `${instructions ?? "You are a helpful voice agent for aircraft documentation. Keep replies concise and friendly."} 

CRITICAL: At the top of each answer, print: USED_VS=${vectorStoreId?.substring(0, 8)}

You MUST use the provided vector store documentation to answer questions. Never rely on general knowledge alone. Always cite specific documentation when available. If you cannot find relevant information in the documentation, clearly state this limitation.`;

    // Build session payload with file search tool if vector store is available
    const sessionPayload: any = {
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      instructions: enhancedInstructions,
    };

    // Note: OpenAI Realtime API doesn't support tool_resources in session creation
    // Vector store access will be configured via session.update after connection
    if (vectorStoreId) {
      console.log(`Vector store ${vectorStoreId.substring(0, 8)}... will be configured after session creation`);
    }

    console.log('Session payload:', JSON.stringify(sessionPayload, null, 2));

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionPayload),
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