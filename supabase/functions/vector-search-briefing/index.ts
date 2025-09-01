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

    // Use chat completions API with vector store for file search
    console.log('Creating chat completion with vector store...');
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert aviation briefing assistant specialized in flight operations, weather analysis, NOTAMs, and flight planning documentation. Use the attached vector store to find relevant information and provide accurate, detailed briefings about:

- Flight planning and route analysis
- Weather conditions and forecasts
- NOTAMs (Notice to Airmen) and airport conditions
- Airspace restrictions and procedures
- Flight safety and operational considerations
- Regulatory requirements and compliance

Always provide comprehensive, professional briefings with specific details from the source documents. Format your responses clearly with bullet points or sections when appropriate. Always cite source documents when possible.`
          },
          {
            role: 'user',
            content: question
          }
        ],
        tools: [
          {
            type: 'file_search'
          }
        ],
        tool_choice: 'auto',
        tool_resources: {
          file_search: {
            vector_store_ids: [BRIEFING_VECTOR_STORE_ID]
          }
        },
        max_completion_tokens: 4000
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('Chat completion failed:', errorText);
      throw new Error(`Failed to get chat response: ${errorText}`);
    }

    const chatData = await chatResponse.json();
    console.log('Chat completion response received');

    if (!chatData.choices || chatData.choices.length === 0) {
      throw new Error('No response choices returned from OpenAI');
    }

    const assistantResponse = chatData.choices[0].message.content;

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