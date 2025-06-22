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

interface TavusTranscriptResponse {
  conversation_id: string
  conversation_name: string
  status: string
  properties: {
    transcript?: Array<{
      role: string
      content: string
      timestamp: number
    }>
    duration?: number
    ended_reason?: string
  }
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

    // End the conversation first
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

    // Wait a moment for Tavus to process the conversation
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Fetch detailed conversation data with transcript
    console.log('Fetching conversation transcript...')
    const transcriptResponse = await fetch(`https://tavusapi.com/v2/conversations/${tavus_conversation_id}?verbose=true`, {
      method: 'GET',
      headers: {
        'x-api-key': tavusApiKey,
        'Content-Type': 'application/json',
      },
    })

    let transcript = null
    let conversationDuration = 0
    let endedReason = 'user_action'

    if (transcriptResponse.ok) {
      const transcriptData: TavusTranscriptResponse = await transcriptResponse.json()
      console.log('Transcript fetched successfully:', {
        hasTranscript: !!transcriptData.properties?.transcript,
        transcriptLength: transcriptData.properties?.transcript?.length || 0,
        duration: transcriptData.properties?.duration
      })

      transcript = transcriptData.properties?.transcript || []
      conversationDuration = transcriptData.properties?.duration || 0
      endedReason = transcriptData.properties?.ended_reason || 'user_action'
    } else {
      console.warn('Failed to fetch transcript:', await transcriptResponse.text())
    }

    // Update conversation status in database with transcript
    const updateData = {
      status: 'ended',
      session_log: {
        ...conversation.session_log,
        ended_at: new Date().toISOString(),
        ended_by: 'user_action',
        transcript: transcript,
        duration: conversationDuration,
        ended_reason: endedReason
      }
    }

    const { error: updateError } = await supabase
      .from('video_conversations')
      .update(updateData)
      .eq('tavus_conversation_id', tavus_conversation_id)

    if (updateError) {
      console.warn('Failed to update conversation status in database:', updateError)
    }

    // Trigger evaluation if this is an exam and we have a transcript
    if (conversation.conversation_type === 'exam' && transcript && transcript.length > 0) {
      console.log('Triggering conversation evaluation for exam...')
      try {
        const evaluationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evaluate-conversation`
        const evaluationResponse = await fetch(evaluationUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: tavus_conversation_id,
            user_id: conversation.user_id,
            course_id: conversation.course_id
          })
        })

        if (!evaluationResponse.ok) {
          console.warn('Failed to trigger evaluation:', await evaluationResponse.text())
        } else {
          console.log('Evaluation triggered successfully')
        }
      } catch (evaluationError) {
        console.warn('Failed to trigger evaluation:', evaluationError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation_id: tavus_conversation_id,
        status: 'ended',
        transcript_length: transcript?.length || 0,
        duration: conversationDuration,
        evaluation_triggered: conversation.conversation_type === 'exam' && transcript && transcript.length > 0
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