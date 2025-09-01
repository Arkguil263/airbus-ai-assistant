import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== BRIEFING VECTOR SEARCH FUNCTION START ===");
  try {
    const { question } = await req.json();
    console.log("Briefing vector search request:", { question });

    // Validate input
    if (!question) throw new Error("Missing required parameter: question");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const BRIEFING_VECTOR_STORE_ID = Deno.env.get("OPENAI_BRIEFING_VECTOR_STORE_ID");

    console.log("Available env variables:", {
      hasOpenAI: !!OPENAI_API_KEY,
      hasBriefingVectorStore: !!BRIEFING_VECTOR_STORE_ID,
      briefingVectorStoreId: BRIEFING_VECTOR_STORE_ID,
      allEnvKeys: Object.keys(Deno.env.toObject()).filter((k) => k.includes("OPENAI")),
    });

    if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured");

    // Simple bearer check (optional, keep if your frontend sends a JWT/app token)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Authorization header required");
    }

    // Helper to call /v1/responses and unwrap text + citations
    async function runResponses({
      model,
      instructions,
      input,
      vectorStoreId,
    }: {
      model: string;
      instructions?: string;
      input: string;
      vectorStoreId?: string;
    }) {
      const body: any = {
        model,
        input,
      };
      if (instructions) body.instructions = instructions;

      if (vectorStoreId) {
        body.tools = [{ type: "file_search" }];
        body.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] },
        };
      }

      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI /responses error: ${errText}`);
      }

      const data = await resp.json();

      // Text extraction
      const answer =
        data.output_text ??
        (Array.isArray(data.output)
          ? data.output
              .flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
              .map((c: any) => {
                if (typeof c === "string") return c;
                if (c?.type === "output_text" && c?.text) return c.text;
                if (c?.type === "text" && c?.text) return c.text;
                return "";
              })
              .join("\n")
          : "");

      // Citations extraction (file_search annotations typically live under output[].content[].annotations)
      const citations: Array<{ file_id?: string; title?: string; url?: string }> = [];
      try {
        const contents = Array.isArray(data.output)
          ? data.output.flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
          : [];

        for (const part of contents) {
          const anns = part?.annotations || [];
          for (const ann of anns) {
            // Common shapes: { type: "file_citation", file_id, title } … may vary
            if (ann?.type?.includes("file") || ann?.file_id || ann?.title) {
              citations.push({
                file_id: ann.file_id,
                title: ann.title || ann.filename || ann.display_name,
                url: ann.url, // sometimes populated if your system stores URLs
              });
            }
          }
        }
      } catch {
        // best-effort only
      }

      return { answer, citations, raw: data };
    }

    // If you have a vector store, use it; otherwise use fallback
    const model = "gpt-4o-mini"; // solid default for RAG; you can swap to a larger model if needed

    if (!BRIEFING_VECTOR_STORE_ID) {
      console.warn("Briefing vector store not configured — using general knowledge fallback.");
      const { answer, citations } = await runResponses({
        model,
        instructions:
          "You are an expert aviation briefing assistant specialized in flight operations, weather analysis, NOTAMs, and flight planning documentation. Provide accurate, detailed briefings about flight planning, weather, NOTAMs, airspace, and safety. If uncertain, say what you would need.",
        input: question,
      });

      return new Response(
        JSON.stringify({
          answer:
            answer +
            "\n\n*Note: Currently using general aviation knowledge. Vector store connection is being configured.*",
          citations, // will usually be empty in fallback
          type: "briefing_fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Using briefing vector store:", BRIEFING_VECTOR_STORE_ID);

    // Primary path: Responses + file_search
    const instructions = `You are an expert aviation briefing assistant specialized in flight operations, weather analysis, NOTAMs, and flight planning documentation.

Use the vector store to find relevant information and provide accurate, detailed briefings about:
- Flight planning and route analysis
- Weather conditions and forecasts
- NOTAMs and airport conditions
- Airspace restrictions and procedures
- Flight safety and operational considerations
- Regulatory requirements and compliance

Always provide comprehensive, professional briefings with bullet points or sections where appropriate.
Cite source documents clearly (short filename/section). If data is missing, state what you need.`;

    const { answer, citations } = await runResponses({
      model,
      instructions,
      input: question,
      vectorStoreId: BRIEFING_VECTOR_STORE_ID,
    });

    return new Response(
      JSON.stringify({
        answer,
        citations, // array of { file_id, title?, url? }
        type: "briefing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("=== ERROR IN BRIEFING VECTOR SEARCH ===");
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("=== END ERROR DEBUG ===");
    return new Response(
      JSON.stringify({
        error: error?.message || "Unknown error occurred",
        details: { name: error?.name, stack: error?.stack?.substring(0, 500) },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
