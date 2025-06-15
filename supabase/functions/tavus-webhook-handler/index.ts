import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Webhook payload validation schema
const TavusWebhookSchema = z.object({
  event_type: z.string(),
  conversation_id: z.string(),
  replica_id: z.string().optional(),
  participant_id: z.string().optional(),
  timestamp: z.string(),
  data: z.record(z.any()).optional()
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

    // Parse and validate webhook payload
    const webhookData = await req.json()
    console.log('Received Tavus webhook:', JSON.stringify(webhookData, null, 2))

    const validatedData = TavusWebhookSchema.parse(webhookData)
    const { event_type, conversation_id, data } = validatedData

    // Find the conversation record in our database
    const { data: conversation, error: findError } = await supabase
      .from('video_conversations')
      .select('*')
      .eq('tavus_conversation_id', conversation_id)
      .single()

    if (findError) {
      console.error('Failed to find conversation:', findError)
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Found conversation record:', conversation.id)

    // Handle different event types
    let updateData: any = {
      session_log: {
        ...conversation.session_log,
        [`${event_type}_at`]: new Date().toISOString(),
        [`${event_type}_data`]: data
      }
    }

    switch (event_type) {
      case 'conversation_started':
        updateData.status = 'active'
        console.log('Conversation started:', conversation_id)
        break

      case 'conversation_ended':
        updateData.status = 'ended'
        updateData.session_log.transcript = data?.transcript || ''
        updateData.session_log.duration = data?.duration || 0
        updateData.session_log.ended_reason = data?.reason || 'completed'
        console.log('Conversation ended:', conversation_id, 'Duration:', data?.duration)
        break

      case 'participant_joined':
        console.log('Participant joined:', validatedData.participant_id)
        break

      case 'participant_left':
        console.log('Participant left:', validatedData.participant_id)
        break

      case 'conversation_failed':
        updateData.status = 'failed'
        updateData.error_message = data?.error || 'Conversation failed'
        console.log('Conversation failed:', conversation_id, data?.error)
        break

      default:
        console.log('Unknown event type:', event_type)
    }

    // Update the conversation record
    const { error: updateError } = await supabase
      .from('video_conversations')
      .update(updateData)
      .eq('id', conversation.id)

    if (updateError) {
      console.error('Failed to update conversation:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update conversation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Successfully processed webhook for conversation:', conversation.id)

    // Send real-time update to frontend if needed
    if (event_type === 'conversation_ended' || event_type === 'conversation_failed') {
      try {
        await supabase
          .channel('conversation_updates')
          .send({
            type: 'broadcast',
            event: 'conversation_update',
            payload: {
              conversation_id: conversation.id,
              tavus_conversation_id: conversation_id,
              status: updateData.status,
              event_type,
              data
            }
          })
        console.log('Sent real-time update for conversation:', conversation.id)
      } catch (realtimeError) {
        console.warn('Failed to send real-time update:', realtimeError)
        // Don't fail the webhook for this
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation_id: conversation.id,
        event_type 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error processing Tavus webhook:', error)

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