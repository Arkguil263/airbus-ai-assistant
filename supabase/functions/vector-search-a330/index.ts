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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const A330_VECTOR_STORE_ID = Deno.env.get('OPENAI_A330_VECTOR_STORE_ID');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    
    if (!A330_VECTOR_STORE_ID) {
      throw new Error('OPENAI_A330_VECTOR_STORE_ID is not set');
    }

    const { question } = await req.json();
    
    if (!question) {
      throw new Error('Question is required');
    }

    console.log('A330 Vector search question:', question);

    // Create a thread for A330-specific search
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        tool_resources: {
          file_search: {
            vector_store_ids: [A330_VECTOR_STORE_ID]
          }
        }
      })
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Thread creation error:', errorText);
      throw new Error(`Failed to create thread: ${errorText}`);
    }

    const thread = await threadResponse.json();
    console.log('A330 thread created:', thread.id);

    // Add the user's message to the thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: `Please search the A330 documentation to answer this question: ${question}`
      })
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Message creation error:', errorText);
      throw new Error(`Failed to add message: ${errorText}`);
    }

    // Create a run with file search
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        instructions: `You are an expert A330 aircraft documentation assistant. Use the file search tool to find relevant information from the A330 manuals and documentation. Provide accurate, specific answers based on the A330 documentation. If you cannot find specific information in the A330 documents, clearly state that.`,
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [A330_VECTOR_STORE_ID]
          }
        }
      })
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Run creation error:', errorText);
      throw new Error(`Failed to create run: ${errorText}`);
    }

    const run = await runResponse.json();
    console.log('A330 run created:', run.id);

    // Poll for completion
    let runStatus = run;
    let attempts = 0;
    const maxAttempts = 30;

    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to check run status');
      }

      runStatus = await statusResponse.json();
      attempts++;
      console.log(`A330 run status: ${runStatus.status} (attempt ${attempts})`);
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`A330 run failed or timed out. Status: ${runStatus.status}`);
    }

    // Get the messages from the thread
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to retrieve messages');
    }

    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    const answer = assistantMessage.content[0]?.text?.value || 'No answer provided';
    console.log('A330 vector search completed successfully');

    return new Response(JSON.stringify({ 
      answer: answer,
      question: question
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in A330 vector search:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});