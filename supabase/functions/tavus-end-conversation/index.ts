import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Request validation schema
const EndConversationRequestSchema = z.object({
  tavus_conversation_id: z.string().min(1)
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Tavus API key
    const tavusApiKey = Deno.env.get('TAVUS_API_KEY')
    if (!tavusApiKey) {
      throw new Error('Tavus API key not configured')
    }

    // Parse and validate request
    const requestData = await req.json()
    console.log('Received end conversation request:', JSON.stringify(requestData, null, 2))

    const validatedRequest = EndConversationRequestSchema.parse(requestData)
    const { tavus_conversation_id } = validatedRequest

    console.log('Ending Tavus conversation:', tavus_conversation_id)

    // Call Tavus API to end the conversation
    const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${tavus_conversation_id}/end`, {
      method: 'POST',
      headers: {
        'x-api-key': tavusApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!tavusResponse.ok) {
      const errorData = await tavusResponse.text()
      console.error('Tavus API error:', {
        status: tavusResponse.status,
        statusText: tavusResponse.statusText,
        body: errorData
      })
      
      // Don't throw error if conversation is already ended or not found
      if (tavusResponse.status === 404 || tavusResponse.status === 409) {
        console.log('Conversation already ended or not found, continuing...')
      } else {
        throw new Error(`Tavus API error (${tavusResponse.status}): ${errorData}`)
      }
    } else {
      console.log('Tavus conversation ended successfully')
    }

    // Update conversation status in database
    const { error: updateError } = await supabase
      .from('video_conversations')
      .update({
        status: 'ended',
        session_log: {
          ended_at: new Date().toISOString(),
          ended_by: 'user_action'
        }
      })
      .eq('tavus_conversation_id', tavus_conversation_id)

    if (updateError) {
      console.warn('Failed to update conversation status in database:', updateError)
      // Don't fail the request for this
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation_id: tavus_conversation_id,
        status: 'ended'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error ending Tavus conversation:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof z.ZodError ? error.errors : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})