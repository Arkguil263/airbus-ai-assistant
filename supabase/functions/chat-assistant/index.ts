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
    const { message, conversationId, aircraftModel = 'A320' } = await req.json();
    console.log('Chat request:', { message, conversationId, aircraftModel });

    // Validate input for normal chat
    if (!message || !conversationId) {
      throw new Error('Missing required parameters: message and conversationId');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get assistant ID for the aircraft model
    const { data: assistantData, error: assistantError } = await supabase
      .from('aircraft_assistants')
      .select('assistant_id')
      .eq('aircraft_model', aircraftModel)
      .single();

    if (assistantError || !assistantData) {
      throw new Error(`No assistant found for aircraft model: ${aircraftModel}`);
    }

    const assistantId = assistantData.assistant_id;

    // Get or create OpenAI thread
    console.log('Getting conversation and thread info...');
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .select('thread_id')
      .eq('id', conversationId)
      .single();

    if (conversationError) {
      throw new Error(`Failed to get conversation: ${conversationError.message}`);
    }

    let threadId = conversationData.thread_id;

    // Create thread if it doesn't exist
    if (!threadId) {
      console.log('Creating new OpenAI thread...');
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({})
      });

      if (!threadResponse.ok) {
        const error = await threadResponse.text();
        console.error('Thread creation failed:', error);
        throw new Error(`Failed to create thread: ${error}`);
      }

      const thread = await threadResponse.json();
      threadId = thread.id;
      console.log('New thread created:', threadId);

      // Store thread_id in conversation
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ thread_id: threadId })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Failed to store thread_id:', updateError);
      }
    } else {
      console.log('Using existing thread:', threadId);
    }

    // Add message to thread
    console.log('Adding message to thread...');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: message
      })
    });

    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      console.error('Message creation failed:', error);
      throw new Error(`Failed to add message: ${error}`);
    }

    // Create and poll run
    console.log('Creating run with assistant...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });

    if (!runResponse.ok) {
      const error = await runResponse.text();
      console.error('Run creation failed:', error);
      throw new Error(`Failed to create run: ${error}`);
    }

    const run = await runResponse.json();
    console.log('Run created:', run.id);

    // Poll run status
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

    // Get the assistant's response
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

    // Store messages in database
    console.log('Storing messages in database...');
    
    // Insert user message
    const { error: userMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        user_email: user.email
      });

    if (userMessageError) {
      console.error('Failed to store user message:', userMessageError);
    }

    // Insert assistant message
    const { error: assistantMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse,
        user_email: user.email
      });

    if (assistantMessageError) {
      console.error('Failed to store assistant message:', assistantMessageError);
    }

    return new Response(JSON.stringify({ 
      response: assistantResponse,
      threadId: threadId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});