export interface CourseConfiguration {
  id: string
  topic: string
  context: string
  depth: number
  user_id: string
}

export interface SyllabusGenerationJob {
  id: string
  course_configuration_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retries: number
  max_retries: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SyllabusTopic {
  summary: string
  keywords: string[]
  content: string
}

export interface SyllabusModule {
  summary: string
  topics: SyllabusTopic[]
}

export interface GeneratedSyllabus {
  modules: SyllabusModule[]
  keywords: string[]
}

export interface WebhookPayload {
  table?: string
  type?: string
  record?: any
}

export interface DirectCallPayload {
  job_id?: string
  course_configuration_id?: string
}

export type RequestPayload = WebhookPayload | DirectCallPayload