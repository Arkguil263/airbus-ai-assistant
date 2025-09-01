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

    console.log('Available env variables:', {
      hasOpenAI: !!OPENAI_API_KEY
    });

    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment');
      throw new Error('OpenAI API key not configured');
    }

    // Simple authentication check - just verify we have a valid authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      throw new Error('Authorization header required');
    }

    console.log('✅ Authorization header validated successfully');

    // Use chat completions API without file_search - simpler approach
    console.log('Creating chat completion...');
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
            content: `You are an expert aviation briefing assistant specialized in flight operations, weather analysis, NOTAMs, and flight planning documentation. Provide accurate, detailed briefings about:

- Flight planning and route analysis
- Weather conditions and forecasts
- NOTAMs (Notice to Airmen) and airport conditions
- Airspace restrictions and procedures
- Flight safety and operational considerations
- Regulatory requirements and compliance

Always provide comprehensive, professional briefings with specific details. Format your responses clearly with bullet points or sections when appropriate.`
          },
          {
            role: 'user',
            content: question
          }
        ],
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