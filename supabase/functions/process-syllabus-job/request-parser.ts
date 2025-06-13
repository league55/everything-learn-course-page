import type { RequestPayload, WebhookPayload, DirectCallPayload } from './types.ts'

export interface ParsedRequest {
  job_id?: string
  course_configuration_id?: string
  isWebhook: boolean
}

export function parseRequestPayload(requestData: RequestPayload): ParsedRequest {
  console.log('Parsing request payload:', JSON.stringify(requestData, null, 2))

  let job_id: string | undefined
  let course_configuration_id: string | undefined
  let isWebhook = false

  // Check if this is a webhook payload (has 'record' property)
  const webhookPayload = requestData as WebhookPayload
  if (webhookPayload.record) {
    console.log('Processing webhook payload')
    console.log('Webhook record:', JSON.stringify(webhookPayload.record, null, 2))
    
    job_id = webhookPayload.record.id
    course_configuration_id = webhookPayload.record.course_configuration_id
    isWebhook = true
    
    console.log('Extracted from webhook - job_id:', job_id, 'course_configuration_id:', course_configuration_id)
  } else {
    // Direct function call format
    console.log('Processing direct function call')
    const directPayload = requestData as DirectCallPayload
    job_id = directPayload.job_id
    course_configuration_id = directPayload.course_configuration_id
    
    console.log('Extracted from direct call - job_id:', job_id, 'course_configuration_id:', course_configuration_id)
  }

  if (!job_id && !course_configuration_id) {
    console.error('Missing required parameters. Request data structure:', JSON.stringify(requestData, null, 2))
    throw new Error('Either job_id or course_configuration_id is required')
  }

  return {
    job_id,
    course_configuration_id,
    isWebhook
  }
}