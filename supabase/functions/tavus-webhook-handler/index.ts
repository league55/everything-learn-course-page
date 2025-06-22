import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Webhook payload validation schema
const TavusWebhookSchema = z.object({
  event_type: z.string(),
  conversation_id: z.string(),
  replica_id: z.string().optional(),
  participant_id: z.string().optional(),
  timestamp: z.string(),
  properties: z.object({
    transcript: z.array(z.object({
      role: z.string(),
      content: z.string(),
      timestamp: z.number().optional()
    })).optional(),
    duration: z.number().optional(),
    ended_reason: z.string().optional(),
    status: z.string().optional()
  }).optional()
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
    const { event_type, conversation_id, properties } = validatedData

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

    console.log('Found conversation record:', conversation.id, 'Event:', event_type)

    // Handle different event types
    let updateData: any = {
      session_log: {
        ...conversation.session_log,
        [`${event_type}_at`]: new Date().toISOString(),
        [`${event_type}_data`]: properties
      }
    }

    switch (event_type) {
      case 'conversation.started':
        updateData.status = 'active'
        console.log('Conversation started:', conversation_id)
        break

      case 'conversation.ended':
        updateData.status = 'ended'
        updateData.session_log.duration = properties?.duration || 0
        updateData.session_log.ended_reason = properties?.ended_reason || 'completed'
        console.log('Conversation ended:', conversation_id, 'Duration:', properties?.duration)
        break

      case 'application.transcription_ready':
        // Store the transcript when it's ready
        const transcript = properties?.transcript || []
        updateData.transcript = transcript
        updateData.session_log.transcript = transcript
        updateData.session_log.transcript_ready_at = new Date().toISOString()
        
        console.log('Transcript ready:', conversation_id, 'Entries:', transcript.length)
        
        // If this is an exam and we have a transcript, trigger evaluation
        if (conversation.conversation_type === 'exam' && transcript.length > 0) {
          console.log('Triggering evaluation for exam conversation...')
          updateData.evaluation_status = 'evaluating'
          
          // Trigger evaluation asynchronously (don't wait for completion)
          triggerEvaluation(conversation_id, conversation.user_id, conversation.course_id)
            .catch(error => console.error('Failed to trigger evaluation:', error))
        }
        break

      case 'participant_joined':
        console.log('Participant joined:', validatedData.participant_id)
        break

      case 'participant_left':
        console.log('Participant left:', validatedData.participant_id)
        break

      case 'conversation_failed':
        updateData.status = 'failed'
        updateData.error_message = properties?.status || 'Conversation failed'
        console.log('Conversation failed:', conversation_id, properties?.status)
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation_id: conversation.id,
        event_type,
        transcript_entries: properties?.transcript?.length || 0
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

// Async function to trigger evaluation
async function triggerEvaluation(conversationId: string, userId: string, courseId: string) {
  try {
    console.log('Triggering evaluation for conversation:', conversationId)
    
    const evaluationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evaluate-conversation`
    const response = await fetch(evaluationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: userId,
        course_id: courseId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Evaluation API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log('Evaluation triggered successfully:', result)
    
  } catch (error) {
    console.error('Failed to trigger evaluation:', error)
    
    // Update conversation to mark evaluation as failed
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase
        .from('video_conversations')
        .update({
          evaluation_status: 'failed',
          session_log: {
            evaluation_error: error instanceof Error ? error.message : 'Unknown error',
            evaluation_error_at: new Date().toISOString()
          }
        })
        .eq('tavus_conversation_id', conversationId)
        
    } catch (updateError) {
      console.error('Failed to update conversation with evaluation error:', updateError)
    }
  }
}