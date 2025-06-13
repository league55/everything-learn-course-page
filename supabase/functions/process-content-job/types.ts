export interface CourseConfiguration {
  id: string
  topic: string
  context: string
  depth: number
  user_id: string
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

export interface Syllabus {
  id: string
  course_configuration_id: string
  modules: SyllabusModule[]
  keywords: string[]
  status: string
}

export interface ContentItem {
  id: string
  course_configuration_id: string
  module_index: number
  topic_index: number
  content_type: ContentType
  title: string
  description: string | null
  content_data: Record<string, any>
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  order_index: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ContentGenerationJob {
  id: string
  course_configuration_id: string
  module_index: number
  topic_index: number
  content_type: ContentType
  status: 'pending' | 'processing' | 'completed' | 'failed'
  prompt: string
  result_content_id: string | null
  error_message: string | null
  retries: number
  max_retries: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'interactive'

export interface GeneratedContent {
  title: string
  content: string
  description?: string
  citations: Citation[]
  metadata: {
    word_count: number
    estimated_reading_time: number
    difficulty_level: string
    key_concepts: string[]
    learning_objectives: string[]
  }
}

export interface Citation {
  id: string
  type: 'academic' | 'web' | 'book' | 'article' | 'documentation'
  title: string
  authors?: string[]
  url?: string
  publication_date?: string
  publisher?: string
  doi?: string
  isbn?: string
  access_date: string
  relevance_score: number
  excerpt?: string
}

export interface WebhookPayload {
  table?: string
  type?: string
  record?: any
}

export interface DirectCallPayload {
  job_id?: string
  course_configuration_id?: string
  module_index?: number
  topic_index?: number
  content_type?: ContentType
}

export type RequestPayload = WebhookPayload | DirectCallPayload