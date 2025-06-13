import type { RequestPayload, WebhookPayload, DirectCallPayload, ContentType } from './types.ts'

export interface ParsedRequest {
  job_id?: string
  course_configuration_id?: string
  module_index?: number
  topic_index?: number
  content_type?: ContentType
  isWebhook: boolean
}

export function parseRequestPayload(requestData: RequestPayload): ParsedRequest {
  console.log('Parsing request payload:', JSON.stringify(requestData, null, 2))

  let job_id: string | undefined
  let course_configuration_id: string | undefined
  let module_index: number | undefined
  let topic_index: number | undefined
  let content_type: ContentType | undefined
  let isWebhook = false

  // Check if this is a webhook payload (has 'record' property)
  const webhookPayload = requestData as WebhookPayload
  if (webhookPayload.record) {
    console.log('Processing webhook payload')
    console.log('Webhook record:', JSON.stringify(webhookPayload.record, null, 2))
    
    job_id = webhookPayload.record.id
    course_configuration_id = webhookPayload.record.course_configuration_id
    module_index = webhookPayload.record.module_index
    topic_index = webhookPayload.record.topic_index
    content_type = webhookPayload.record.content_type
    isWebhook = true
    
    console.log('Extracted from webhook:', { 
      job_id, 
      course_configuration_id, 
      module_index, 
      topic_index, 
      content_type 
    })
  } else {
    // Direct function call format
    console.log('Processing direct function call')
    const directPayload = requestData as DirectCallPayload
    job_id = directPayload.job_id
    course_configuration_id = directPayload.course_configuration_id
    module_index = directPayload.module_index
    topic_index = directPayload.topic_index
    content_type = directPayload.content_type
    
    console.log('Extracted from direct call:', { 
      job_id, 
      course_configuration_id, 
      module_index, 
      topic_index, 
      content_type 
    })
  }

  if (!job_id && (!course_configuration_id || module_index === undefined || topic_index === undefined || !content_type)) {
    console.error('Missing required parameters. Request data structure:', JSON.stringify(requestData, null, 2))
    throw new Error('Either job_id or complete content specification (course_configuration_id, module_index, topic_index, content_type) is required')
  }

  return {
    job_id,
    course_configuration_id,
    module_index,
    topic_index,
    content_type,
    isWebhook
  }
}