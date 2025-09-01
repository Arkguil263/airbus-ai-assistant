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

  console.log('=== BRIEFING FUNCTION START ===');
  
  try {
    const { question } = await req.json();
    console.log('Question received:', question);

    if (!question) {
      throw new Error('Missing question parameter');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API key available:', !!OPENAI_API_KEY);

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Making OpenAI API call...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an expert aviation briefing assistant. Provide detailed, professional briefings about flight operations, weather, NOTAMs, airspace restrictions, and flight safety. Format responses clearly with bullet points when appropriate.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_completion_tokens: 2000
      })
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received successfully');

    const answer = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      answer,
      type: 'briefing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in briefing function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});