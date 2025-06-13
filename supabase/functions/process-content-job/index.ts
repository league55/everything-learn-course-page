import { parseRequestPayload } from './request-parser.ts'
import { JobProcessor } from './job-processor.ts'

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
    // Get the raw request body for logging
    const rawBody = await req.text()
    console.log('Raw request body:', rawBody)
    
    // Parse the JSON
    let requestData
    try {
      requestData = JSON.parse(rawBody)
      console.log('Parsed request data:', JSON.stringify(requestData, null, 2))
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    // Parse the request payload
    const { 
      job_id, 
      course_configuration_id, 
      module_index, 
      topic_index, 
      content_type 
    } = parseRequestPayload(requestData)

    // Process the job
    const processor = new JobProcessor()
    await processor.processJob(
      job_id,
      course_configuration_id,
      module_index,
      topic_index,
      content_type
    )

    return new Response(
      JSON.stringify({ 
        message: 'Content generated successfully',
        job_id,
        course_id: course_configuration_id,
        module_index,
        topic_index,
        content_type
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error processing content generation job:', error)

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})