import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log("=== ANALYZE-FLIGHT-FILES CALLED ===");
    console.log("Number of files:", files.length);
    console.log("OPENAI_API_KEY set:", !!OPENAI_API_KEY);

    // First, upload files to OpenAI Assistant
    const uploadedFiles = [];
    
    for (const file of files) {
      try {
        // Convert base64 back to binary
        const binaryString = atob(file.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create form data for file upload
        const formData = new FormData();
        const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
        formData.append('file', blob, file.name);
        formData.append('purpose', 'assistants');

        // Upload to OpenAI
        const uploadResp = await fetch("https://api.openai.com/v1/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (!uploadResp.ok) {
          const uploadError = await uploadResp.text();
          console.error(`File upload failed for ${file.name}:`, uploadError);
          continue;
        }

        const uploadData = await uploadResp.json();
        uploadedFiles.push(uploadData.id);
        console.log(`Successfully uploaded file: ${file.name}, ID: ${uploadData.id}`);
        
      } catch (uploadError) {
        console.error(`Error uploading file ${file.name}:`, uploadError);
      }
    }

    if (uploadedFiles.length === 0) {
      throw new Error("Failed to upload any files to OpenAI");
    }

    // Create assistant with file search capability
    const assistantResp = await fetch("https://api.openai.com/v1/assistants", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        name: "Flight Analysis Assistant",
        instructions: `You are an expert aviation analyst. Analyze the uploaded files which may contain flight plans, weather data, and NOTAMs. Provide a comprehensive analysis covering:

1. FLIGHT PLAN ANALYSIS:
   - Route details and waypoints
   - Aircraft type and performance
   - Fuel requirements and reserves
   - Alternate airports
   - Critical phases of flight

2. WEATHER ANALYSIS:
   - Current and forecast conditions along route
   - Significant weather phenomena
   - Wind patterns and turbulence
   - Visibility and cloud conditions
   - Weather hazards and recommendations

3. NOTAM ANALYSIS:
   - Airport closures or restrictions
   - Navigation aid outages
   - Runway conditions
   - Temporary flight restrictions
   - Critical safety notices

4. OPERATIONAL RECOMMENDATIONS:
   - Pre-flight considerations
   - En-route decision points
   - Risk assessment
   - Contingency planning
   - Safety recommendations

Provide specific, actionable insights that pilots can use for flight planning and execution.`,
        model: "gpt-4.1-2025-04-14",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_stores: [{
              file_ids: uploadedFiles
            }]
          }
        }
      }),
    });

    if (!assistantResp.ok) {
      const assistantError = await assistantResp.text();
      console.error("Assistant creation failed:", assistantError);
      throw new Error("Failed to create analysis assistant");
    }

    const assistantData = await assistantResp.json();
    console.log("Assistant created:", assistantData.id);

    // Create thread and run analysis
    const threadResp = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: "Please analyze all the uploaded files and provide a comprehensive flight analysis covering flight plan, weather, and NOTAMs as outlined in your instructions."
        }]
      }),
    });

    if (!threadResp.ok) {
      throw new Error("Failed to create analysis thread");
    }

    const threadData = await threadResp.json();
    
    // Run the assistant
    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: assistantData.id
      }),
    });

    if (!runResp.ok) {
      throw new Error("Failed to start analysis run");
    }

    const runData = await runResp.json();
    
    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResp = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs/${runData.id}`, {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2"
        },
      });
      
      const statusData = await statusResp.json();
      console.log("Run status:", statusData.status);
      
      if (statusData.status === "completed") {
        // Get the messages
        const messagesResp = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "assistants=v2"
          },
        });
        
        const messagesData = await messagesResp.json();
        const analysis = messagesData.data[0]?.content[0]?.text?.value || "Analysis completed but no content found.";
        
        // Clean up: delete assistant and files
        try {
          await fetch(`https://api.openai.com/v1/assistants/${assistantData.id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "OpenAI-Beta": "assistants=v2"
            },
          });
          
          for (const fileId of uploadedFiles) {
            await fetch(`https://api.openai.com/v1/files/${fileId}`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
              },
            });
          }
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
        
        return new Response(JSON.stringify({ analysis }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } else if (statusData.status === "failed" || statusData.status === "cancelled") {
        throw new Error(`Analysis failed with status: ${statusData.status}`);
      }
      
      attempts++;
    }
    
    throw new Error("Analysis timed out");

  } catch (e) {
    console.error("analyze-flight-files error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});