import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import { z } from 'npm:zod@^3.23.8'

// Request validation schema
const EvaluationRequestSchema = z.object({
  conversation_id: z.string().min(1),
  user_id: z.string().uuid(),
  course_id: z.string().uuid()
})

// Evaluation result schema
const EvaluationResultSchema = z.object({
  score: z.number().min(0).max(100),
  breakdown: z.object({
    conceptual_accuracy: z.number().min(0).max(30),
    depth_of_analysis: z.number().min(0).max(40),
    practical_application: z.number().min(0).max(30)
  }),
  strengths: z.array(z.string()).min(1).max(5),
  weaknesses: z.array(z.string()).min(1).max(3),
  impactful_quotes: z.array(z.string()).min(1).max(5),
  overall_assessment: z.string().min(50).max(500),
  recommendations: z.array(z.string()).min(1).max(3)
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

async function evaluateConversationWithAI(
  transcript: any[],
  courseTopic: string,
  moduleSummary: string,
  apiKey: string
): Promise<z.infer<typeof EvaluationResultSchema>> {
  
  // Extract user responses from transcript
  const userResponses = transcript
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .join('\n\n--- Next Response ---\n\n')

  const evaluationPrompt = `As an expert examiner in "${courseTopic}", evaluate the following user responses from an oral examination.

MODULE FOCUS: ${moduleSummary}

USER RESPONSES:
${userResponses}

EVALUATION CRITERIA:
1. Conceptual Accuracy (0-30 points): Correctness of fundamental concepts, terminology usage, and theoretical understanding
2. Depth of Analysis (0-40 points): Critical thinking, connections between concepts, synthesis of ideas, analytical reasoning
3. Practical Application (0-30 points): Real-world relevance, problem-solving ability, implementation understanding

ASSESSMENT REQUIREMENTS:
- Provide specific, actionable feedback
- Identify 3-5 key strengths with examples
- Highlight 1-3 areas for improvement
- Extract 3-5 most impactful/insightful user quotes
- Give overall assessment and learning recommendations
- Be fair but rigorous in academic standards

OUTPUT FORMAT (JSON only, no additional text):
{
  "score": <total score 0-100>,
  "breakdown": {
    "conceptual_accuracy": <score 0-30>,
    "depth_of_analysis": <score 0-40>,
    "practical_application": <score 0-30>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "impactful_quotes": ["quote 1", "quote 2", "quote 3"],
  "overall_assessment": "Comprehensive assessment paragraph covering performance highlights and growth areas",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`

  console.log('Sending evaluation request to OpenAI...')
  console.log('Course:', courseTopic)
  console.log('Module:', moduleSummary)
  console.log('User responses length:', userResponses.length)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic examiner. Provide fair, rigorous, and constructive evaluation of student responses. Return only valid JSON.'
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
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

  console.log('AI evaluation response received, length:', aiResponse.length)

  // Parse and validate the AI response
  let parsedResponse
  try {
    parsedResponse = JSON.parse(aiResponse)
  } catch (parseError) {
    throw new Error(`Failed to parse AI JSON response: ${parseError}`)
  }

  // Validate against schema
  const validatedResponse = EvaluationResultSchema.parse(parsedResponse)
  
  console.log('Evaluation completed successfully:', {
    score: validatedResponse.score,
    strengths: validatedResponse.strengths.length,
    weaknesses: validatedResponse.weaknesses.length,
    quotes: validatedResponse.impactful_quotes.length
  })

  return validatedResponse
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

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse and validate request
    const requestData = await req.json()
    console.log('Received evaluation request:', requestData)

    const validatedRequest = EvaluationRequestSchema.parse(requestData)
    const { conversation_id, user_id, course_id } = validatedRequest

    // Fetch conversation data with transcript
    const { data: conversation, error: conversationError } = await supabase
      .from('video_conversations')
      .select('*')
      .eq('tavus_conversation_id', conversation_id)
      .single()

    if (conversationError || !conversation) {
      throw new Error(`Conversation not found: ${conversationError?.message}`)
    }

    // Get course information
    const { data: course, error: courseError } = await supabase
      .from('course_configuration')
      .select('topic, context, depth')
      .eq('id', course_id)
      .single()

    if (courseError || !course) {
      throw new Error(`Course not found: ${courseError?.message}`)
    }

    // Extract transcript from session log
    const transcript = conversation.session_log?.transcript
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      throw new Error('No transcript available for evaluation')
    }

    console.log('Starting AI evaluation for conversation:', conversation_id)
    console.log('Course:', course.topic)
    console.log('Transcript entries:', transcript.length)

    // Get module summary (this could be enhanced to get specific module info)
    const moduleSummary = `Course depth level ${course.depth}: ${course.context}`

    // Evaluate conversation with AI
    const evaluation = await evaluateConversationWithAI(
      transcript,
      course.topic,
      moduleSummary,
      openaiApiKey
    )

    console.log('AI evaluation completed successfully')

    // Store evaluation result in database
    const { error: updateError } = await supabase
      .from('video_conversations')
      .update({
        session_log: {
          ...conversation.session_log,
          evaluation_result: evaluation,
          evaluated_at: new Date().toISOString()
        }
      })
      .eq('tavus_conversation_id', conversation_id)

    if (updateError) {
      console.error('Failed to store evaluation result:', updateError)
      throw new Error(`Failed to store evaluation: ${updateError.message}`)
    }

    // Check if score qualifies for certificate (typically 70% or higher)
    const qualifiesForCertificate = evaluation.score >= 70

    // If score qualifies, generate certificate
    let certificate = null
    if (qualifiesForCertificate) {
      console.log('Score qualifies for certificate, generating...')
      
      try {
        // Generate mock examination results for certificate
        const examinationResults = {
          studentId: user_id,
          courseId: course_id,
          moduleResults: [{
            moduleIndex: 0,
            moduleName: course.topic,
            score: evaluation.score,
            maxScore: 100,
            questionsAnswered: transcript.filter(t => t.role === 'user').length,
            correctAnswers: Math.round((evaluation.score / 100) * transcript.filter(t => t.role === 'user').length),
            timeSpent: conversation.session_log?.duration || 900,
            topics: [{
              topicIndex: 0,
              topicName: course.topic,
              score: evaluation.score,
              maxScore: 100,
              understanding: evaluation.score >= 90 ? 'excellent' : 
                            evaluation.score >= 80 ? 'good' : 
                            evaluation.score >= 70 ? 'fair' : 'poor'
            }]
          }],
          totalScore: evaluation.score,
          maxPossibleScore: 100,
          completionDate: new Date().toISOString(),
          timeSpent: conversation.session_log?.duration || 900,
          examType: 'final' as const
        }

        // Call certificate API
        const { getCertificateAPI } = await import('../../../src/lib/certificate-api.ts')
        certificate = await getCertificateAPI().onExaminationCompletion(
          user_id,
          course_id,
          examinationResults
        )

        console.log('Certificate generated successfully:', certificate.certificateId)

      } catch (certificateError) {
        console.error('Failed to generate certificate:', certificateError)
        // Don't fail the evaluation if certificate generation fails
      }
    }

    console.log('Conversation evaluation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        evaluation,
        qualifies_for_certificate: qualifiesForCertificate,
        certificate: certificate ? {
          certificate_id: certificate.certificateId,
          score: certificate.score,
          max_score: certificate.maxScore
        } : null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error evaluating conversation:', error)

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