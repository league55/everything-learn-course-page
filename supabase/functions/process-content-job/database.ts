import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import type { 
  ContentGenerationJob, 
  CourseConfiguration, 
  Syllabus,
  ContentItem,
  GeneratedContent 
} from './types.ts'

export class DatabaseService {
  private supabase

  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
  }

  async getJobById(jobId: string): Promise<ContentGenerationJob> {
    console.log('Fetching content generation job by ID:', jobId)
    const { data, error } = await this.supabase
      .from('content_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      console.error('Error fetching job by ID:', error)
      throw new Error(`Failed to fetch job: ${error.message}`)
    }

    console.log('Found job:', JSON.stringify(data, null, 2))
    return data
  }

  async getPendingJobForContent(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    contentType: string
  ): Promise<ContentGenerationJob> {
    console.log('Fetching pending job for content:', { courseId, moduleIndex, topicIndex, contentType })
    const { data, error } = await this.supabase
      .from('content_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseId)
      .eq('module_index', moduleIndex)
      .eq('topic_index', topicIndex)
      .eq('content_type', contentType)
      .eq('status', 'pending')
      .single()

    if (error) {
      console.error('Error fetching pending job for content:', error)
      throw new Error(`No pending job found for content: ${error.message}`)
    }

    console.log('Found pending job:', JSON.stringify(data, null, 2))
    return data
  }

  async updateJobStatus(
    jobId: string, 
    status: ContentGenerationJob['status'], 
    options: {
      errorMessage?: string
      startedAt?: string
      completedAt?: string
      retries?: number
      resultContentId?: string
    } = {}
  ): Promise<void> {
    console.log(`Updating job ${jobId} status to ${status}`)
    
    const updateData: any = { status }
    
    if (options.errorMessage !== undefined) updateData.error_message = options.errorMessage
    if (options.startedAt) updateData.started_at = options.startedAt
    if (options.completedAt) updateData.completed_at = options.completedAt
    if (options.retries !== undefined) updateData.retries = options.retries
    if (options.resultContentId) updateData.result_content_id = options.resultContentId

    const { error } = await this.supabase
      .from('content_generation_jobs')
      .update(updateData)
      .eq('id', jobId)

    if (error) {
      console.error('Error updating job status:', error)
      throw new Error(`Failed to update job status: ${error.message}`)
    }
  }

  async getCourseConfiguration(courseId: string): Promise<CourseConfiguration> {
    console.log('Fetching course configuration:', courseId)
    const { data, error } = await this.supabase
      .from('course_configuration')
      .select('*')
      .eq('id', courseId)
      .single()

    if (error) {
      console.error('Error fetching course configuration:', error)
      throw new Error(`Failed to fetch course configuration: ${error.message}`)
    }

    console.log('Found course configuration:', JSON.stringify(data, null, 2))
    return data
  }

  async getSyllabus(courseId: string): Promise<Syllabus> {
    console.log('Fetching syllabus:', courseId)
    const { data, error } = await this.supabase
      .from('syllabus')
      .select('*')
      .eq('course_configuration_id', courseId)
      .single()

    if (error) {
      console.error('Error fetching syllabus:', error)
      throw new Error(`Failed to fetch syllabus: ${error.message}`)
    }

    console.log('Found syllabus with', data.modules?.length || 0, 'modules')
    return data
  }

  async getTopicFromSyllabus(
    syllabus: Syllabus,
    moduleIndex: number,
    topicIndex: number
  ): Promise<{ module: any; topic: any }> {
    if (!syllabus.modules || moduleIndex >= syllabus.modules.length) {
      throw new Error(`Module index ${moduleIndex} out of range`)
    }

    const module = syllabus.modules[moduleIndex]
    if (!module.topics || topicIndex >= module.topics.length) {
      throw new Error(`Topic index ${topicIndex} out of range in module ${moduleIndex}`)
    }

    const topic = module.topics[topicIndex]
    return { module, topic }
  }

  async createContentItem(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    generatedContent: GeneratedContent
  ): Promise<ContentItem> {
    console.log('Creating content item in database...')
    
    // Get the next order index for this topic
    const { data: existingContent } = await this.supabase
      .from('content_items')
      .select('order_index')
      .eq('course_configuration_id', courseId)
      .eq('module_index', moduleIndex)
      .eq('topic_index', topicIndex)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingContent && existingContent.length > 0 
      ? existingContent[0].order_index + 1 
      : 0

    const { data, error } = await this.supabase
      .from('content_items')
      .insert({
        course_configuration_id: courseId,
        module_index: moduleIndex,
        topic_index: topicIndex,
        content_type: 'text',
        title: generatedContent.title,
        description: generatedContent.description || null,
        content_data: {
          content: generatedContent.content,
          format: 'markdown',
          citations: generatedContent.citations,
          metadata: generatedContent.metadata,
          generated_at: new Date().toISOString()
        },
        file_path: null,
        file_size: null,
        mime_type: 'text/markdown',
        order_index: nextOrderIndex,
        metadata: {
          ai_generated: true,
          generation_timestamp: new Date().toISOString(),
          ...generatedContent.metadata
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating content item:', error)
      throw new Error(`Failed to create content item: ${error.message}`)
    }

    console.log('Content item created successfully:', data.id)
    return data
  }

  async getExistingContentForTopic(
    courseId: string,
    moduleIndex: number,
    topicIndex: number
  ): Promise<ContentItem[]> {
    const { data, error } = await this.supabase
      .from('content_items')
      .select('*')
      .eq('course_configuration_id', courseId)
      .eq('module_index', moduleIndex)
      .eq('topic_index', topicIndex)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error fetching existing content:', error)
      throw new Error(`Failed to fetch existing content: ${error.message}`)
    }

    return data || []
  }
}