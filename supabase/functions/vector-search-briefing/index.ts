import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== BRIEFING VECTOR SEARCH FUNCTION START ===');
  try {
    const { question } = await req.json();
    console.log('Briefing vector search request:', { question });

    // Validate input
    if (!question) {
      console.error('Missing question parameter');
      throw new Error('Missing required parameter: question');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const BRIEFING_VECTOR_STORE_ID = Deno.env.get('OPENAI_BRIEFING_VECTOR_STORE_ID');

    console.log('Available env variables:', {
      hasOpenAI: !!OPENAI_API_KEY,
      hasBriefingVectorStore: !!BRIEFING_VECTOR_STORE_ID,
      briefingVectorStoreId: BRIEFING_VECTOR_STORE_ID
    });

    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment');
      throw new Error('OpenAI API key not configured');
    }

    if (!BRIEFING_VECTOR_STORE_ID) {
      console.error('Briefing vector store ID not configured');
      throw new Error('Briefing vector store ID not configured');
    }

    console.log('Using briefing vector store:', BRIEFING_VECTOR_STORE_ID);

    // Simple authentication check - just verify we have a valid authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      throw new Error('Authorization header required');
    }

    console.log('✅ Authorization header validated successfully');

    // Step 1: Create a temporary thread for vector search
    console.log('Creating temporary thread for briefing vector search...');
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
            vector_store_ids: [BRIEFING_VECTOR_STORE_ID]
          }
        }
      })
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Thread creation failed:', errorText);
      throw new Error(`Failed to create thread: ${errorText}`);
    }

    const thread = await threadResponse.json();
    const threadId = thread.id;
    console.log('Thread created:', threadId);

    // Step 2: Add the user's question to the thread
    console.log('Adding question to thread...');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: question
      })
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Message creation failed:', errorText);
      throw new Error(`Failed to add message: ${errorText}`);
    }

    // Step 3: Create a run using the thread's vector store access
    console.log('Creating run for briefing vector search...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        instructions: `You are an expert aviation briefing assistant specialized in flight operations, weather analysis, NOTAMs, and flight planning documentation. Use the attached vector store to find relevant information and provide accurate, detailed briefings about:

- Flight planning and route analysis
- Weather conditions and forecasts
- NOTAMs (Notice to Airmen) and airport conditions
- Airspace restrictions and procedures
- Flight safety and operational considerations
- Regulatory requirements and compliance

Always provide comprehensive, professional briefings with specific details from the source documents. Format your responses clearly with bullet points or sections when appropriate. Always cite source documents when possible.`,
        tools: [
          {
            type: 'file_search'
          }
        ],
        max_completion_tokens: 4000
      })
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Run creation failed:', errorText);
      throw new Error(`Failed to create run: ${errorText}`);
    }

    const run = await runResponse.json();
    console.log('Run created:', run.id);

    // Step 4: Poll run status
    let runStatus = run;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Run timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}`, {
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
      console.log('Run status:', runStatus.status);
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }

    // Step 5: Get the assistant's response
    console.log('Fetching briefing assistant response...');
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to fetch messages');
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data.find((msg: any) => 
      msg.role === 'assistant' && msg.run_id === run.id
    );

    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    const assistantResponse = assistantMessage.content[0].text.value;
    console.log('Briefing assistant response received');

    // Step 6: Clean up - delete the temporary thread
    try {
      await fetch(`https://api.openai.com/v1/threads/${threadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      console.log('Temporary thread cleaned up');
    } catch (error) {
      console.warn('Failed to cleanup thread:', error);
    }

    return new Response(JSON.stringify({ 
      answer: assistantResponse,
      type: 'briefing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR IN BRIEFING VECTOR SEARCH ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error object:', error);
    console.error('=== END ERROR DEBUG ===');
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: {
        name: error?.name,
        stack: error?.stack?.substring(0, 500) // Truncate stack trace
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});