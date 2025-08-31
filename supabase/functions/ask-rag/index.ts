import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { query, vector_store_id, max_results } = await req.json().catch(() => ({}));
    if (!query || !vector_store_id) {
      return new Response(JSON.stringify({ error: "Provide { query, vector_store_id }" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log('RAG request:', { query, vector_store_id });

    const payload = {
      model: "gpt-4o-mini",
      input: query,
      tools: [{ type: "file_search" }],
      tool_config: {
        file_search: {
          vector_store_ids: [vector_store_id],
          max_num_results: typeof max_results === "number" ? max_results : 8,
        },
      },
      // system: "Answer strictly from the provided files; if unsure, say so."
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text) } catch { /* keep raw text */ }

    const output_text =
      data?.output_text ??
      (Array.isArray(data?.output) ? data.output.map((o: any) => o?.content ?? "").join("\n") : "");

    return new Response(JSON.stringify({
      ok: resp.ok,
      status: resp.status,
      error: resp.ok ? undefined : (data?.error ?? text),
      output_text,
      raw: resp.ok ? data : undefined,
    }), {
      status: resp.ok ? 200 : resp.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-rag error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});