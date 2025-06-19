import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Request validation schema
const AudioGenerationRequestSchema = z.object({
  job_id: z.string().uuid(),
  course_configuration_id: z.string().uuid(),
  module_index: z.number().int().min(0),
  topic_index: z.number().int().min(0),
  source_text: z.string().min(1).max(50000), // Limit text length
  voice_id: z.string().optional()
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
}

interface ElevenLabsResponse {
  audio: Uint8Array
  contentType: string
}

interface AICleaningResponse {
  success: boolean
  cleaned_text: string
  word_count: number
  estimated_duration_minutes: number
  removed_elements?: string[]
  summary?: string
  error?: string
}

async function cleanTextWithAI(
  text: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string> {
  console.log('Calling AI text cleaner for text length:', text.length)
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-text-cleaner`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        context_type: 'comprehensive_content',
        target_duration_minutes: 5
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI cleaning API error (${response.status}): ${errorText}`)
    }

    const data: AICleaningResponse = await response.json()
    
    if (!data.success) {
      throw new Error(`AI cleaning failed: ${data.error}`)
    }

    console.log('AI cleaning successful:', {
      originalLength: text.length,
      cleanedLength: data.cleaned_text.length,
      wordCount: data.word_count,
      estimatedDuration: data.estimated_duration_minutes,
      removedElements: data.removed_elements?.length || 0
    })

    return data.cleaned_text

  } catch (error) {
    console.error('AI cleaning failed, falling back to basic cleaning:', error)
    
    // Fallback to basic cleaning if AI fails
    return fallbackCleanTextForTTS(text)
  }
}

function fallbackCleanTextForTTS(text: string): string {
  console.log('Using fallback text cleaning')
  
  // Basic markdown and formatting removal as fallback
  let cleanText = text
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/\[[^\]]*\]/g, '') // Remove citation brackets
    .replace(/\([^)]*\d{4}[^)]*\)/g, '') // Remove year citations
    .trim()

  // Limit length for TTS
  if (cleanText.length > 5000) {
    cleanText = cleanText.substring(0, 4900) + '...'
  }

  return cleanText
}

async function generateAudioWithElevenLabs(
  text: string, 
  voiceId: string, 
  apiKey: string
): Promise<ElevenLabsResponse> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const audio = new Uint8Array(audioBuffer)
  
  return {
    audio,
    contentType: response.headers.get('content-type') || 'audio/mpeg'
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get ElevenLabs API key
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Parse and validate request
    const requestData = await req.json()
    console.log('Received audio generation request:', requestData.job_id)

    const validatedRequest = AudioGenerationRequestSchema.parse(requestData)
    const {
      job_id,
      course_configuration_id,
      module_index,
      topic_index,
      source_text,
      voice_id = 'EXAVITQu4vr4xnSDxMaL' // Default ElevenLabs voice
    } = validatedRequest

    // Update job status to processing
    await supabase
      .from('audio_generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job_id)

    console.log('Starting audio generation for job:', job_id)

    // Clean text using AI first, with fallback to basic cleaning
    const cleanText = await cleanTextWithAI(source_text, supabaseUrl, supabaseKey)
    
    if (!cleanText || cleanText.length < 10) {
      throw new Error('Cleaned text is too short or empty')
    }

    console.log('Text cleaning completed. Cleaned text length:', cleanText.length)

    // Generate audio with ElevenLabs
    const { audio, contentType } = await generateAudioWithElevenLabs(
      cleanText,
      voice_id,
      elevenLabsApiKey
    )

    console.log('Audio generated successfully, size:', audio.length)

    // Generate file path
    const fileName = `course-${course_configuration_id}-module-${module_index}-topic-${topic_index}-${Date.now()}.mp3`
    const filePath = `courses/${course_configuration_id}/audio/${fileName}`

    // Upload audio to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('course-audio')
      .upload(filePath, audio, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`)
    }

    console.log('Audio uploaded to storage:', uploadData.path)

    // Get public URL for the audio file
    const { data: urlData } = supabase.storage
      .from('course-audio')
      .getPublicUrl(filePath)

    // Calculate approximate duration based on cleaned text
    const wordCount = cleanText.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 // seconds (150 words per minute)

    // Update job with success
    const { error: updateError } = await supabase
      .from('audio_generation_jobs')
      .update({
        status: 'completed',
        audio_file_path: urlData.publicUrl,
        audio_file_size: audio.length,
        duration_seconds: estimatedDuration,
        completed_at: new Date().toISOString()
      })
      .eq('id', job_id)

    if (updateError) {
      console.error('Failed to update job status:', updateError)
      // Don't throw error here, audio was generated successfully
    }

    console.log('Audio generation completed successfully for job:', job_id)

    return new Response(
      JSON.stringify({
        success: true,
        job_id,
        audio_file_path: urlData.publicUrl,
        audio_file_size: audio.length,
        duration_seconds: estimatedDuration,
        cleaned_text_length: cleanText.length,
        original_text_length: source_text.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error generating audio:', error)

    // Try to update job status to failed if we have job_id
    try {
      const requestData = await req.clone().json()
      if (requestData.job_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabase
          .from('audio_generation_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', requestData.job_id)
      }
    } catch (updateError) {
      console.error('Failed to update job status to failed:', updateError)
    }

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