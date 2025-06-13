import { DatabaseService } from './database.ts'
import { AIGenerator } from './ai-generator.ts'
import { validateGeneratedContent } from './validation.ts'
import type { ContentGenerationJob, ContentType } from './types.ts'

export class JobProcessor {
  private db: DatabaseService
  private ai: AIGenerator

  constructor() {
    this.db = new DatabaseService()
    this.ai = new AIGenerator()
  }

  async processJob(
    jobId?: string,
    courseConfigurationId?: string,
    moduleIndex?: number,
    topicIndex?: number,
    contentType?: ContentType
  ): Promise<void> {
    let job: ContentGenerationJob

    // Get the job record
    if (jobId) {
      job = await this.db.getJobById(jobId)
    } else if (courseConfigurationId && moduleIndex !== undefined && topicIndex !== undefined && contentType) {
      job = await this.db.getPendingJobForContent(
        courseConfigurationId,
        moduleIndex,
        topicIndex,
        contentType
      )
    } else {
      throw new Error('Either job_id or complete content specification is required')
    }

    // Validate job eligibility
    await this.validateJobEligibility(job)

    console.log(`Processing content generation job: ${job.id}`)

    try {
      // Update job status to processing
      await this.db.updateJobStatus(job.id, 'processing', {
        startedAt: new Date().toISOString(),
        retries: job.retries + 1
      })

      // Get course configuration and syllabus
      const courseConfig = await this.db.getCourseConfiguration(job.course_configuration_id)
      const syllabus = await this.db.getSyllabus(job.course_configuration_id)

      // Get existing content for context
      const existingContent = await this.db.getExistingContentForTopic(
        job.course_configuration_id,
        job.module_index,
        job.topic_index
      )

      // Generate content using AI
      const generatedContent = await this.ai.generateContent(
        courseConfig,
        syllabus,
        job.module_index,
        job.topic_index,
        job.content_type,
        job.prompt,
        existingContent
      )

      // Validate the generated content
      const validatedContent = validateGeneratedContent(generatedContent)
      console.log('Content validation successful')

      // Create content item in the database
      const contentItem = await this.db.createContentItem(
        job.course_configuration_id,
        job.module_index,
        job.topic_index,
        validatedContent
      )

      // Mark job as completed
      await this.db.updateJobStatus(job.id, 'completed', {
        errorMessage: null,
        completedAt: new Date().toISOString(),
        resultContentId: contentItem.id
      })

      console.log(`Successfully generated content for job: ${job.id}, content: ${contentItem.title}`)

    } catch (error) {
      console.error('Error during job processing:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Update job as failed
      await this.db.updateJobStatus(job.id, 'failed', {
        errorMessage,
        completedAt: new Date().toISOString()
      })

      throw error
    }
  }

  private async validateJobEligibility(job: ContentGenerationJob): Promise<void> {
    // Check if job is eligible for processing
    if (job.status !== 'pending') {
      const message = `Job ${job.id} is not pending (status: ${job.status})`
      console.log(message)
      throw new Error(message)
    }

    // Check retry limits
    if (job.retries >= job.max_retries) {
      const message = `Job ${job.id} has exceeded maximum retries (${job.retries}/${job.max_retries})`
      console.log(message)
      
      await this.db.updateJobStatus(job.id, 'failed', {
        errorMessage: 'Maximum retries exceeded',
        completedAt: new Date().toISOString()
      })

      throw new Error(message)
    }

    // Validate content type
    const validContentTypes = ['text', 'image', 'video', 'audio', 'document', 'interactive']
    if (!validContentTypes.includes(job.content_type)) {
      const message = `Invalid content type: ${job.content_type}`
      console.log(message)
      
      await this.db.updateJobStatus(job.id, 'failed', {
        errorMessage: message,
        completedAt: new Date().toISOString()
      })

      throw new Error(message)
    }
  }
}