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

  console.log('=== UNIFIED CHAT FUNCTION START ===');
  try {
    const { question, aircraftModel = 'A320' } = await req.json();
    console.log('Unified chat request:', { question, aircraftModel });

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

    console.log('✅ OpenAI API key found, proceeding with chat completion');

    // Simple authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      throw new Error('Authorization header required');
    }

    console.log('✅ Authorization header validated successfully');

    let answer;

    // Use assistant-driven briefing for Briefing aircraft model
    if (aircraftModel === 'Briefing') {
      console.log('Using assistant-driven briefing for questions...');
      
      const briefingResponse = await fetch('https://hlalijpmqogytkwljppc.supabase.co/functions/v1/briefing-assistant', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question,
          aircraftModel 
        })
      });

      if (!briefingResponse.ok) {
        const errorText = await briefingResponse.text();
        console.error('Briefing assistant error:', errorText);
        throw new Error(`Briefing assistant failed: ${errorText}`);
      }

      const briefingData = await briefingResponse.json();
      answer = briefingData.answer;
      
      console.log('✅ Successfully received answer from briefing assistant');
      
      return new Response(JSON.stringify({ 
        answer: answer,
        citations: briefingData.citations || [],
        aircraftModel: aircraftModel,
        type: briefingData.type || 'assistant_with_rag'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Use simple chat completion for other aircraft models
      console.log('Making OpenAI chat completion request...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant for ${aircraftModel} aircraft operations and documentation. Provide accurate, professional responses about aircraft systems, procedures, and technical information for the ${aircraftModel}. If you don't have specific information about the ${aircraftModel}, clearly state that and provide general aviation guidance where appropriate.`
            },
            {
              role: 'user',
              content: question
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      answer = data.choices[0]?.message?.content;

      if (!answer) {
        console.error('No answer in OpenAI response:', data);
        throw new Error('No answer received from OpenAI');
      }

      console.log('✅ Successfully received answer from OpenAI');
    }

    return new Response(JSON.stringify({ 
      answer: answer,
      aircraftModel: aircraftModel
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR IN UNIFIED CHAT ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('=== END ERROR DEBUG ===');
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: {
        name: error?.name,
        stack: error?.stack?.substring(0, 500)
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});