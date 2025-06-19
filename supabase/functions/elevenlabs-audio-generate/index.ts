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

function chunkText(text: string, maxChunkSize: number = 2500): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const sentenceWithPunctuation = trimmedSentence + '.'
    
    if ((currentChunk + sentenceWithPunctuation).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = sentenceWithPunctuation
      } else {
        // Single sentence is too long, force split
        chunks.push(sentenceWithPunctuation.substring(0, maxChunkSize))
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  console.log(`Text split into ${chunks.length} chunks:`, chunks.map(c => c.length))
  return chunks
}

async function generateAudioWithElevenLabs(
  text: string, 
  voiceId: string, 
  apiKey: string
): Promise<ElevenLabsResponse> {
  // Validate text length and quality
  if (!text || text.trim().length < 10) {
    throw new Error('Text is too short for audio generation')
  }

  // Clean up any remaining problematic characters
  const cleanedText = text
    .replace(/[^\w\s.,!?;:()\-'"]/g, ' ') // Remove special characters that might cause issues
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  console.log('Sending to ElevenLabs:')
  console.log('- Text length:', cleanedText.length)
  console.log('- Voice ID:', voiceId)
  console.log('- First 100 chars:', cleanedText.substring(0, 100))
  console.log('- Last 100 chars:', cleanedText.substring(Math.max(0, cleanedText.length - 100)))

  // ElevenLabs has a limit of ~5000 characters per request
  if (cleanedText.length > 4500) {
    console.log('Text too long, chunking and using first chunk only')
    const chunks = chunkText(cleanedText, 2500)
    const firstChunk = chunks[0]
    console.log('Using first chunk of length:', firstChunk.length)
    return generateSingleAudioChunk(firstChunk, voiceId, apiKey)
  }

  return generateSingleAudioChunk(cleanedText, voiceId, apiKey)
}

async function generateSingleAudioChunk(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ElevenLabsResponse> {
  // Use the non-streaming endpoint for better reliability
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
  
  const requestBody = {
    text: text,
    model_id: 'eleven_multilingual_v2', // More reliable model
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true
    },
    output_format: 'mp3_44100_128' // Explicit format
  }

  console.log('ElevenLabs request body:', {
    textLength: text.length,
    model_id: requestBody.model_id,
    voice_settings: requestBody.voice_settings,
    output_format: requestBody.output_format
  })
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  })

  console.log('ElevenLabs response status:', response.status)
  console.log('ElevenLabs response headers:', Object.fromEntries(response.headers.entries()))

  if (!response.ok) {
    const errorText = await response.text()
    console.error('ElevenLabs API error response:', errorText)
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const audio = new Uint8Array(audioBuffer)
  
  console.log('Generated audio stats:')
  console.log('- Audio buffer size:', audioBuffer.byteLength)
  console.log('- Audio array length:', audio.length)
  console.log('- Content type:', response.headers.get('content-type'))

  if (audio.length < 1000) {
    console.warn('Generated audio is suspiciously small:', audio.length, 'bytes')
    console.warn('This might indicate an issue with the text or API call')
  }
  
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

    console.log('Job details:', {
      job_id,
      course_id: course_configuration_id,
      module: module_index,
      topic: topic_index,
      source_text_length: source_text.length,
      voice_id
    })

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
    console.log('Cleaned text preview (first 200 chars):', cleanText.substring(0, 200))

    // Generate audio with ElevenLabs
    const { audio, contentType } = await generateAudioWithElevenLabs(
      cleanText,
      voice_id,
      elevenLabsApiKey
    )

    console.log('Audio generated successfully, size:', audio.length)

    // Validate audio size
    if (audio.length < 1000) {
      throw new Error(`Generated audio is too small (${audio.length} bytes). This likely indicates a problem with the text processing or ElevenLabs API response.`)
    }

    // Generate file path
    const fileName = `course-${course_configuration_id}-module-${module_index}-topic-${topic_index}-${Date.now()}.mp3`
    const filePath = `courses/${course_configuration_id}/audio/${fileName}`

    console.log('Uploading to storage path:', filePath)

    // Upload audio to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('course-audio')
      .upload(filePath, audio, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(`Failed to upload audio: ${uploadError.message}`)
    }

    console.log('Audio uploaded to storage:', uploadData.path)

    // Get public URL for the audio file
    const { data: urlData } = supabase.storage
      .from('course-audio')
      .getPublicUrl(filePath)

    console.log('Public URL generated:', urlData.publicUrl)

    // Calculate approximate duration based on cleaned text
    const wordCount = cleanText.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 // seconds (150 words per minute)

    console.log('Audio stats:', {
      word_count: wordCount,
      estimated_duration: estimatedDuration,
      file_size: audio.length,
      public_url: urlData.publicUrl
    })

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
        original_text_length: source_text.length,
        word_count: wordCount
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