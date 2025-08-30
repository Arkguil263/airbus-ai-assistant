import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not set");
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Creating ephemeral session with OpenAI...");

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: "You are a concise, pilot-friendly voice assistant for Airbus aircraft. If you need document details about aircraft systems, procedures, or technical information, call the searchDocs tool.",
        tools: [
          {
            type: "function",
            name: "searchDocs",
            description: "Search the aircraft documentation and return relevant technical information, procedures, or system details.",
            parameters: {
              type: "object",
              properties: {
                query: { 
                  type: "string", 
                  description: "Natural language search query for aircraft documentation" 
                },
                topK: { 
                  type: "number", 
                  default: 5,
                  description: "Number of relevant documents to return"
                },
              },
              required: ["query"],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return new Response(JSON.stringify({ error: "OpenAI error", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const ephemeralKey = data?.client_secret?.value;

    if (!ephemeralKey) {
      console.error("No ephemeral key received from OpenAI");
      return new Response(JSON.stringify({ error: "No ephemeral key received" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Successfully created ephemeral session");

    return new Response(JSON.stringify({ ephemeralKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ephemeral function:", error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});