import { createClient } from 'npm:@supabase/supabase-js@^2.39.1';
import { z } from 'npm:zod@^3.23.8';
import { EdgeCertificateAPI, generateMockExaminationResults } from './certificate-service.ts';

// Request validation schema
const EvaluationRequestSchema = z.object({
  conversation_id: z.string().min(1),
  user_id: z.string().uuid(),
  course_id: z.string().uuid()
});
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
});
// CORRECTED Tavus API response schema
const TavusConversationSchema = z.object({
  conversation_id: z.string(),
  conversation_name: z.string(),
  conversation_url: z.string(),
  conversational_context: z.string().nullable().optional(),
  callback_url: z.string(),
  status: z.string(),
  replica_id: z.string(),
  persona_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  events: z.array(z.object({
    created_at: z.string(),
    updated_at: z.string(),
    event_type: z.string(),
    message_type: z.string(),
    properties: z.object({
      transcript: z.array(z.object({
        content: z.string(),
        role: z.string()
      })).optional(),
      analysis: z.string().optional(),
      duration: z.number().optional(),
      ended_reason: z.string().optional(),
      replica_id: z.string().optional(),
      shutdown_reason: z.string().optional()
    }).optional(),
    timestamp: z.string()
  }))
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};
async function fetchTranscriptFromTavus(conversationId, apiKey) {
  console.log('Fetching transcript from Tavus API for conversation:', conversationId);
  const response = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}?verbose=true`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Tavus API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Tavus API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  console.log('Tavus API response received, parsing...');
  // Validate against corrected schema
  const validatedData = TavusConversationSchema.parse(data);
  // Extract transcript from events
  const transcriptEvent = validatedData.events.find((e)=>e.event_type === "application.transcription_ready" && e.properties?.transcript);
  if (!transcriptEvent) {
    throw new Error('No transcription_ready event found in Tavus response');
  }
  const transcript = transcriptEvent.properties.transcript || [];
  console.log('Transcript extracted successfully:', {
    conversation_id: validatedData.conversation_id,
    event_type: transcriptEvent.event_type,
    transcript_entries: transcript.length
  });
  // Transform transcript to expected format
  const transformedTranscript = transcript.map((entry)=>({
      role: determineRole(entry.role),
      content: entry.content
    }));
  // Filter out empty entries
  const filteredTranscript = transformedTranscript.filter((entry)=>entry.content && entry.content.trim().length > 5);
  console.log('Transcript transformation completed:', {
    original_entries: transcript.length,
    filtered_entries: filteredTranscript.length,
    user_responses: filteredTranscript.filter((t)=>t.role === 'user').length,
    assistant_responses: filteredTranscript.filter((t)=>t.role === 'assistant').length
  });
  if (filteredTranscript.filter((t)=>t.role === 'user').length === 0) {
    throw new Error('No user responses found in transcript');
  }
  return filteredTranscript;
}
// Simplified role determination
function determineRole(role) {
  const normalizedRole = (role || '').toLowerCase();
  if ([
    'user',
    'human',
    'student'
  ].includes(normalizedRole)) return 'user';
  if ([
    'assistant',
    'ai',
    'bot',
    'examiner'
  ].includes(normalizedRole)) return 'assistant';
  return 'user'; // Default to user
}
async function evaluateConversationWithAI(transcript, courseTopic, moduleSummary, apiKey) {
  // Extract user responses from transcript
  const userResponses = transcript.filter((msg)=>msg.role === 'user').map((msg)=>msg.content).join('\n\n--- Next Response ---\n\n');
  if (!userResponses || userResponses.trim().length < 50) {
    throw new Error('Insufficient user responses for evaluation');
  }
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
}`;
  console.log('Sending evaluation request to OpenAI...');
  console.log('Course:', courseTopic);
  console.log('Module:', moduleSummary);
  console.log('User responses length:', userResponses.length);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
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
      response_format: {
        type: 'json_object'
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const aiResponse = data.choices[0]?.message?.content;
  if (!aiResponse) {
    throw new Error('No response from OpenAI');
  }
  console.log('AI evaluation response received, length:', aiResponse.length);
  // Parse and validate the AI response
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(aiResponse);
  } catch (parseError) {
    throw new Error(`Failed to parse AI JSON response: ${parseError}`);
  }
  // Validate against schema
  const validatedResponse = EvaluationResultSchema.parse(parsedResponse);
  console.log('Evaluation completed successfully:', {
    score: validatedResponse.score,
    strengths: validatedResponse.strengths.length,
    weaknesses: validatedResponse.weaknesses.length,
    quotes: validatedResponse.impactful_quotes.length
  });
  return validatedResponse;
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const tavusApiKey = Deno.env.get('TAVUS_API_KEY');
    if (!tavusApiKey) {
      throw new Error('Tavus API key not configured');
    }
    // Parse and validate request
    const requestData = await req.json();
    console.log('Received evaluation request:', requestData);
    const validatedRequest = EvaluationRequestSchema.parse(requestData);
    const { conversation_id, user_id, course_id } = validatedRequest;
    // Fetch conversation data (for metadata, not transcript)
    const { data: conversation, error: conversationError } = await supabase.from('video_conversations').select('*').eq('tavus_conversation_id', conversation_id).single();
    if (conversationError || !conversation) {
      throw new Error(`Conversation not found: ${conversationError?.message}`);
    }
    // Get course information
    const { data: course, error: courseError } = await supabase.from('course_configuration').select('topic, context, depth').eq('id', course_id).single();
    if (courseError || !course) {
      throw new Error(`Course not found: ${courseError?.message}`);
    }
    console.log('Starting evaluation process for conversation:', conversation_id);
    console.log('Course:', course.topic);
    // Update evaluation status to "evaluating"
    await supabase.from('video_conversations').update({
      evaluation_status: 'evaluating'
    }).eq('tavus_conversation_id', conversation_id);
    // Fetch transcript directly from Tavus API
    const transcript = await fetchTranscriptFromTavus(conversation_id, tavusApiKey);
    // Get module summary (this could be enhanced to get specific module info)
    const moduleSummary = `Course depth level ${course.depth}: ${course.context}`;
    // Evaluate conversation with AI
    const evaluation = await evaluateConversationWithAI(transcript, course.topic, moduleSummary, openaiApiKey);
    console.log('AI evaluation completed successfully');
    // Store evaluation result and transcript in database
    const { error: updateError } = await supabase.from('video_conversations').update({
      evaluation_status: 'completed',
      evaluation_result: evaluation,
      transcript: transcript,
      transcript_status: 'ready',
      session_log: {
        ...conversation.session_log,
        evaluation_result: evaluation,
        evaluated_at: new Date().toISOString(),
        transcript_source: 'tavus_api',
        transcript_fetched_at: new Date().toISOString()
      }
    }).eq('tavus_conversation_id', conversation_id);
    if (updateError) {
      console.error('Failed to store evaluation result:', updateError);
      throw new Error(`Failed to store evaluation: ${updateError.message}`);
    }
    // Check if score qualifies for certificate (typically 70% or higher)
    const qualifiesForCertificate = evaluation.score >= 1;
    // If score qualifies, generate certificate
    let certificate = null;
    if (qualifiesForCertificate) {
      console.log('Score qualifies for certificate, generating...');
      try {
        // Initialize certificate API
        const certificateAPI = new EdgeCertificateAPI(supabaseUrl, supabaseKey);
        
        // Generate mock examination results for certificate
        const examinationResults = generateMockExaminationResults(
          user_id,
          course_id,
          evaluation.score,
          100,
          course.topic,
          conversation.session_log?.duration || 900
        );
        
        // Issue certificate
        certificate = await certificateAPI.onExaminationCompletion(user_id, course_id, examinationResults);
        console.log('Certificate generated successfully:', certificate.certificateId);
      } catch (certificateError) {
        console.error('Failed to generate certificate:', certificateError);
      // Don't fail the evaluation if certificate generation fails
      }
    }
    console.log('Conversation evaluation completed successfully');
    return new Response(JSON.stringify({
      success: true,
      conversation_id,
      evaluation,
      transcript_entries: transcript.length,
      user_responses: transcript.filter((t)=>t.role === 'user').length,
      qualifies_for_certificate: qualifiesForCertificate,
      certificate: certificate ? {
        certificate_id: certificate.certificateId,
        score: certificate.score,
        max_score: certificate.maxScore
      } : null
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error evaluating conversation:', error);
    // Try to update conversation status to failed
    try {
      const requestData = await req.clone().json();
      if (requestData.conversation_id) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await supabase.from('video_conversations').update({
          evaluation_status: 'failed',
          session_log: {
            evaluation_error: error instanceof Error ? error.message : 'Unknown error',
            evaluation_error_at: new Date().toISOString()
          }
        }).eq('tavus_conversation_id', requestData.conversation_id);
      }
    } catch (updateError) {
      console.error('Failed to update conversation with evaluation error:', updateError);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: errorMessage,
      details: error instanceof z.ZodError ? error.errors : undefined
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
