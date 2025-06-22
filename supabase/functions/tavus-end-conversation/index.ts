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

    // Get conversation details from database first
    const { data: conversation, error: fetchError } = await supabase
      .from('video_conversations')
      .select('*')
      .eq('tavus_conversation_id', tavus_conversation_id)
      .single()

    if (fetchError || !conversation) {
      console.error('Failed to find conversation in database:', fetchError)
      throw new Error('Conversation not found in database')
    }

    // Call Tavus API to end the conversation
    const tavusEndResponse = await fetch(`https://tavusapi.com/v2/conversations/${tavus_conversation_id}/end`, {
      method: 'POST',
      headers: {
        'x-api-key': tavusApiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!tavusEndResponse.ok) {
      const errorData = await tavusEndResponse.text()
      console.error('Tavus API error:', {
        status: tavusEndResponse.status,
        statusText: tavusEndResponse.statusText,
        body: errorData
      })
      
      // Don't throw error if conversation is already ended or not found
      if (tavusEndResponse.status !== 404 && tavusEndResponse.status !== 409) {
        throw new Error(`Tavus API error (${tavusEndResponse.status}): ${errorData}`)
      }
    }

    console.log('Tavus conversation ended successfully')

    // Update conversation status in database (transcript will be handled by webhook)
    const updateData = {
      status: 'ending', // Intermediate status while waiting for webhook
      session_log: {
        ...conversation.session_log,
        ended_at: new Date().toISOString(),
        ended_by: 'user_action',
        awaiting_transcript: true
      }
    }

    // For exam conversations, mark as waiting for evaluation
    if (conversation.conversation_type === 'exam') {
      updateData.session_log.awaiting_evaluation = true
    }

    const { error: updateError } = await supabase
      .from('video_conversations')
      .update(updateData)
      .eq('tavus_conversation_id', tavus_conversation_id)

    if (updateError) {
      console.warn('Failed to update conversation status in database:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation_id: tavus_conversation_id,
        status: 'ending',
        message: 'Conversation ended. Transcript and evaluation will be processed asynchronously.',
        awaiting_transcript: true,
        awaiting_evaluation: conversation.conversation_type === 'exam'
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