import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("=== BRIEFING ASSISTANT FUNCTION START ===");
  try {
    const { question, aircraftModel = "A320" } = await req.json();
    console.log("Briefing assistant request:", { question, aircraftModel });

    if (!question) throw new Error("Missing required parameter: question");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_ASSISTANT_ID = Deno.env.get("OPENAI_ASSISTANT_ID");
    
    console.log("Available env variables:", {
      hasOpenAI: !!OPENAI_API_KEY,
      hasAssistantId: !!OPENAI_ASSISTANT_ID,
      assistantId: OPENAI_ASSISTANT_ID?.substring(0, 8) + "...",
      aircraftModel,
    });

    if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured");
    if (!OPENAI_ASSISTANT_ID) throw new Error("Assistant ID not configured");

    // Optional bearer check (keep if you pass a JWT/app token from frontend)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Authorization header required");
    }

    // Map aircraft -> vector store
    const vecByModel: Record<string, string | undefined> = {
      A320: Deno.env.get("OPENAI_A320_VECTOR_STORE_ID"),
      A330: Deno.env.get("OPENAI_A330_VECTOR_STORE_ID"),
      A350: Deno.env.get("OPENAI_A350_VECTOR_STORE_ID"),
      Briefing: Deno.env.get("OPENAI_BRIEFING_VECTOR_STORE_ID"),
    };
    const fallbackVs = Deno.env.get("OPENAI_BRIEFING_VECTOR_STORE_ID");
    const vectorStoreId = vecByModel[aircraftModel] ?? fallbackVs;
    
    console.log("Vector store mapping:", {
      aircraftModel,
      vectorStoreId: vectorStoreId?.substring(0, 8) + "...",
      hasVectorStore: !!vectorStoreId,
    });

    if (!vectorStoreId) {
      throw new Error(`Vector store not configured for ${aircraftModel}`);
    }

    // Helper to call /v1/responses (Assistant-driven)
    async function runResponsesWithAssistant({
      assistantId,
      input,
      vectorStoreId,
      model = "gpt-4o-mini",
    }: {
      assistantId: string;
      input: string;
      vectorStoreId: string;
      model?: string;
    }) {
      const body: any = {
        assistant_id: assistantId,
        model,
        input,
        tools: [{ type: "file_search" }],
        tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
      };

      console.log("Calling OpenAI /v1/responses with assistant...");
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
        console.error("OpenAI API error:", errText);
        throw new Error(`OpenAI /responses error: ${errText}`);
      }

      const data = await resp.json();

      // Unwrap text
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

      // Extract citations (best-effort)
      const citations: Array<{ file_id?: string; title?: string; url?: string }> = [];
      try {
        const contents = Array.isArray(data.output)
          ? data.output.flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
          : [];
        for (const part of contents) {
          const anns = part?.annotations || [];
          for (const ann of anns) {
            if (ann?.type?.includes("file") || ann?.file_id || ann?.title) {
              citations.push({
                file_id: ann.file_id,
                title: ann.title || ann.filename || ann.display_name,
                url: ann.url,
              });
            }
          }
        }
      } catch (citationError) {
        console.warn("Error extracting citations:", citationError);
      }

      console.log("Successfully processed assistant response:", {
        answerLength: answer.length,
        citationsCount: citations.length,
      });

      return { answer, citations, raw: data };
    }

    const { answer, citations } = await runResponsesWithAssistant({
      assistantId: OPENAI_ASSISTANT_ID,
      input: question,
      vectorStoreId,
    });

    return new Response(
      JSON.stringify({ 
        answer, 
        citations, 
        aircraftModel, 
        type: "assistant_with_rag" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("=== ERROR IN BRIEFING ASSISTANT ===");
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
