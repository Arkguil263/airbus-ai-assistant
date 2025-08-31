import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifySecretRequest {
  secretWord: string
}

interface VerifySecretResponse {
  isValid: boolean
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { secretWord }: VerifySecretRequest = await req.json()

    if (!secretWord || typeof secretWord !== 'string') {
      console.log('Invalid secret word provided:', secretWord)
      return new Response(
        JSON.stringify({ 
          isValid: false, 
          error: 'Secret word is required' 
        } as VerifySecretResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Verifying secret word for registration access')

    // Query the registration_secrets table using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('registration_secrets')
      .select('secret_word')
      .eq('is_active', true)
      .eq('secret_word', secretWord.trim())
      .single()

    if (error) {
      console.log('Database error or no matching secret found:', error.code)
      
      if (error.code === 'PGRST116') {
        // No matching secret word found
        return new Response(
          JSON.stringify({ 
            isValid: false, 
            error: "Invalid secret word. This knowledge base belongs to a private group and requires authorization to register." 
          } as VerifySecretResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          isValid: false, 
          error: "Error verifying secret word. Please try again." 
        } as VerifySecretResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Secret word verified successfully')

    // Secret word is valid
    return new Response(
      JSON.stringify({ 
        isValid: true 
      } as VerifySecretResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error in verify-secret function:', error)
    
    return new Response(
      JSON.stringify({ 
        isValid: false, 
        error: "Internal server error. Please try again." 
      } as VerifySecretResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})