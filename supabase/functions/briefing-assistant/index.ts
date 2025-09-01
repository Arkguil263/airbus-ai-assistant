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

    console.log("Using assistant ID for briefing analysis:", {
      aircraftModel,
      hasAssistantId: !!OPENAI_ASSISTANT_ID,
    });

    // Helper to use OpenAI Assistants API
    async function runAssistant({
      assistantId,
      input,
    }: {
      assistantId: string;
      input: string;
    }) {
      console.log("Creating thread...");
      // Create a thread
      const threadResp = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({}),
      });

      if (!threadResp.ok) {
        const errText = await threadResp.text();
        console.error("Thread creation error:", errText);
        throw new Error(`Thread creation error: ${errText}`);
      }

      const thread = await threadResp.json();
      console.log("Thread created:", thread.id);

      // Add message to thread
      const messageResp = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          role: "user",
          content: input,
        }),
      });

      if (!messageResp.ok) {
        const errText = await messageResp.text();
        console.error("Message creation error:", errText);
        throw new Error(`Message creation error: ${errText}`);
      }

      console.log("Message added to thread");

      // Run the assistant
      const runResp = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({
          assistant_id: assistantId,
        }),
      });

      if (!runResp.ok) {
        const errText = await runResp.text();
        console.error("Run creation error:", errText);
        throw new Error(`Run creation error: ${errText}`);
      }

      const run = await runResp.json();
      console.log("Run started:", run.id);

      // Poll for completion
      let runStatus = run;
      while (runStatus.status === "queued" || runStatus.status === "in_progress") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResp = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2",
          },
        });

        if (!statusResp.ok) {
          const errText = await statusResp.text();
          console.error("Status check error:", errText);
          throw new Error(`Status check error: ${errText}`);
        }

        runStatus = await statusResp.json();
        console.log("Run status:", runStatus.status);
      }

      if (runStatus.status !== "completed") {
        console.error("Run failed with status:", runStatus.status);
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }

      // Get messages
      const messagesResp = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2",
        },
      });

      if (!messagesResp.ok) {
        const errText = await messagesResp.text();
        console.error("Messages retrieval error:", errText);
        throw new Error(`Messages retrieval error: ${errText}`);
      }

      const messages = await messagesResp.json();
      console.log("Messages retrieved:", messages.data.length);

      // Get the assistant's response
      const assistantMessage = messages.data.find((msg: any) => msg.role === "assistant");
      if (!assistantMessage) {
        throw new Error("No assistant response found");
      }

      // Extract text content
      const textContent = assistantMessage.content.find((content: any) => content.type === "text");
      const answer = textContent?.text?.value || "No response generated";

      // Extract citations from annotations
      const citations: Array<{ file_id?: string; title?: string; url?: string }> = [];
      try {
        const annotations = textContent?.text?.annotations || [];
        for (const annotation of annotations) {
          if (annotation.type === "file_citation") {
            citations.push({
              file_id: annotation.file_citation?.file_id,
              title: annotation.text || "Referenced file",
            });
          }
        }
      } catch (citationError) {
        console.warn("Error extracting citations:", citationError);
      }

      console.log("Successfully processed assistant response:", {
        answerLength: answer.length,
        citationsCount: citations.length,
      });

      return { answer, citations };
    }

    const { answer, citations } = await runAssistant({
      assistantId: OPENAI_ASSISTANT_ID,
      input: question,
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
