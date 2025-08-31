import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    const { question, aircraftModel = 'A320' } = await req.json();
    console.log('Vector search request:', { question, aircraftModel });
    console.log('Available env variables:', {
      hasOpenAI: !!Deno.env.get('OPENAI_API_KEY'),
      hasA320VectorStore: !!Deno.env.get('OPENAI_A320_VECTOR_STORE_ID'),
      a320VectorStoreId: Deno.env.get('OPENAI_A320_VECTOR_STORE_ID')
    });

    // Validate input
    if (!question) {
      console.error('Missing question parameter');
      throw new Error('Missing required parameter: question');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment');
      throw new Error('OpenAI API key not configured');
    }

    // Get the appropriate vector store ID based on aircraft model
    let vectorStoreId;
    if (aircraftModel === 'A320') {
      vectorStoreId = Deno.env.get('OPENAI_A320_VECTOR_STORE_ID');
    } else if (aircraftModel === 'A330') {
      vectorStoreId = Deno.env.get('OPENAI_A330_VECTOR_STORE_ID');
    } else if (aircraftModel === 'A350') {
      vectorStoreId = Deno.env.get('OPENAI_A350_VECTOR_STORE_ID');
    }

    if (!vectorStoreId) {
      console.error(`Vector store ID not configured for aircraft model: ${aircraftModel}`);
      console.error('Available env keys:', Object.keys(Deno.env.toObject()).filter(k => k.includes('VECTOR')));
      throw new Error(`Vector store ID not configured for aircraft model: ${aircraftModel}`);
    }

    console.log('Using vector store:', vectorStoreId);

    // Initialize Supabase client for authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header found');
      throw new Error('No authorization header');
    }

    // Extract the JWT token (remove 'Bearer ' prefix)
    const jwt = authHeader.replace('Bearer ', '');
    console.log('JWT token extracted, length:', jwt.length);

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    console.log('Auth verification result:', { user: !!user, error: !!authError });
    
    if (authError) {
      console.error('Auth error details:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      console.error('No user found after auth verification');
      throw new Error('User not found');
    }

    console.log('User authenticated:', user.email);

    // Step 1: Create a temporary thread for vector search
    console.log('Creating temporary thread for vector search...');
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
            vector_store_ids: [vectorStoreId]
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

    // Step 3: Create a run with a simple assistant for vector search
    console.log('Creating run for vector search...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        instructions: `You are a helpful assistant for ${aircraftModel} aircraft documentation. Use the vector store to find relevant information and provide accurate, concise answers about ${aircraftModel} procedures, systems, and technical details. Always cite the source documents when possible.`,
        tools: [
          {
            type: 'file_search'
          }
        ]
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
    console.log('Fetching assistant response...');
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
    console.log('Assistant response received');

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
      aircraftModel: aircraftModel
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in vector search function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});