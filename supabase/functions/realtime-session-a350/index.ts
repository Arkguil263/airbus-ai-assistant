import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_REALTIME_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_REALTIME_API_KEY is not set');
    }

    console.log('Creating A350 realtime session with model: gpt-4o-realtime-preview-2024-12-17');

    // Get the instructions from the request body, with A350-specific default
    const { instructions } = await req.json().catch(() => ({}));
    
    const defaultInstructions = `You are a helpful voice agent for A350 aircraft documentation. 
      You have access to A350 manuals and technical documentation. 
      Keep replies concise and friendly. Focus on A350-specific information when answering questions.
      When users ask about aircraft systems, procedures, or technical details, provide accurate A350-specific information.`;

    // Request an ephemeral token from OpenAI for A350
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: instructions || defaultInstructions
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    console.log("A350 session created successfully");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error in A350 realtime session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});