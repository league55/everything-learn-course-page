import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Request validation schema
const TextCleaningRequestSchema = z.object({
  text: z.string().min(1).max(50000),
  context_type: z.enum(['topic_overview', 'comprehensive_content']).optional().default('comprehensive_content'),
  target_duration_minutes: z.number().min(1).max(30).optional().default(5)
})

// AI Response schema for validation
const AIResponseSchema = z.object({
  cleaned_text: z.string().min(10),
  word_count: z.number().min(1),
  estimated_duration_minutes: z.number().min(0.1),
  removed_elements: z.array(z.string()).optional(),
  summary: z.string().optional()
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

async function cleanTextWithAI(
  text: string,
  contextType: string,
  targetDuration: number,
  apiKey: string,
  retryCount = 0
): Promise<z.infer<typeof AIResponseSchema>> {
  const maxRetries = 3
  
  const systemPrompt = `You are an expert text processor specialized in preparing educational content for text-to-speech synthesis. Your task is to clean and optimize text for audio narration while preserving all educational value.

IMPORTANT RULES:
1. Remove ALL markdown formatting (##, **, *, \`\`\`, [], (), etc.)
2. Remove or rewrite ALL URLs and web links - either remove them entirely or replace with descriptive text
3. Remove citation references like [1], (Smith, 2020), etc.
4. Remove "Additional Resources", "Further Reading", "References" sections entirely
5. Convert lists into flowing narrative text
6. Remove code blocks and technical syntax
7. Rewrite any "click here", "see below", "above figure" references
8. Make the text flow naturally for speech - use connecting phrases
9. Target approximately ${targetDuration} minutes of audio (about ${Math.round(targetDuration * 150)} words)
10. Keep all core educational content and explanations
11. Make the language conversational and suitable for audio learning

Return ONLY a valid JSON object with this exact structure:
{
  "cleaned_text": "the cleaned text ready for speech synthesis",
  "word_count": number_of_words_in_cleaned_text,
  "estimated_duration_minutes": estimated_audio_duration,
  "removed_elements": ["list", "of", "removed", "elements"],
  "summary": "brief description of what was cleaned"
}`

  const userPrompt = `Please clean this ${contextType} for text-to-speech synthesis:

---
${text}
---

Remember: Return ONLY the JSON object, no other text or formatting.`

  try {
    console.log(`Attempting AI text cleaning (attempt ${retryCount + 1})`)
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
    }

    const data: OpenAIResponse = await response.json()
    const aiResponse = data.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('No response from OpenAI')
    }

    console.log('Raw AI response length:', aiResponse.length)

    // Parse and validate the AI response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch (parseError) {
      throw new Error(`Failed to parse AI JSON response: ${parseError}`)
    }

    // Validate against schema
    const validatedResponse = AIResponseSchema.parse(parsedResponse)
    
    console.log('AI cleaning successful:', {
      originalLength: text.length,
      cleanedLength: validatedResponse.cleaned_text.length,
      wordCount: validatedResponse.word_count,
      estimatedDuration: validatedResponse.estimated_duration_minutes
    })

    return validatedResponse

  } catch (error) {
    console.error(`AI cleaning attempt ${retryCount + 1} failed:`, error)
    
    if (retryCount < maxRetries) {
      console.log(`Retrying... (${retryCount + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // Exponential backoff
      return cleanTextWithAI(text, contextType, targetDuration, apiKey, retryCount + 1)
    }
    
    throw new Error(`AI text cleaning failed after ${maxRetries + 1} attempts: ${error.message}`)
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
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse and validate request
    const requestData = await req.json()
    console.log('Received text cleaning request, text length:', requestData.text?.length)

    const validatedRequest = TextCleaningRequestSchema.parse(requestData)
    const { text, context_type, target_duration_minutes } = validatedRequest

    // Clean text with AI
    const cleanedResult = await cleanTextWithAI(
      text,
      context_type,
      target_duration_minutes,
      openaiApiKey
    )

    console.log('Text cleaning completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        ...cleanedResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error cleaning text:', error)

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