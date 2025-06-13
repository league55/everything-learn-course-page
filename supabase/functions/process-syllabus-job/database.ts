import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'
import type { SyllabusGenerationJob, CourseConfiguration, GeneratedSyllabus } from './types.ts'

export class DatabaseService {
  private supabase

  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
  }

  async getJobById(jobId: string): Promise<SyllabusGenerationJob> {
    console.log('Fetching job by ID:', jobId)
    const { data, error } = await this.supabase
      .from('syllabus_generation_jobs')
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

  async getPendingJobForCourse(courseId: string): Promise<SyllabusGenerationJob> {
    console.log('Fetching pending job for course:', courseId)
    const { data, error } = await this.supabase
      .from('syllabus_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseId)
      .eq('status', 'pending')
      .single()

    if (error) {
      console.error('Error fetching pending job for course:', error)
      throw new Error(`No pending job found for course: ${error.message}`)
    }

    console.log('Found pending job:', JSON.stringify(data, null, 2))
    return data
  }

  async updateJobStatus(
    jobId: string, 
    status: SyllabusGenerationJob['status'], 
    options: {
      errorMessage?: string
      startedAt?: string
      completedAt?: string
      retries?: number
    } = {}
  ): Promise<void> {
    console.log(`Updating job ${jobId} status to ${status}`)
    
    const updateData: any = { status }
    
    if (options.errorMessage !== undefined) updateData.error_message = options.errorMessage
    if (options.startedAt) updateData.started_at = options.startedAt
    if (options.completedAt) updateData.completed_at = options.completedAt
    if (options.retries !== undefined) updateData.retries = options.retries

    const { error } = await this.supabase
      .from('syllabus_generation_jobs')
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

  async updateSyllabus(courseId: string, syllabus: GeneratedSyllabus): Promise<void> {
    console.log('Updating syllabus in database...')
    const { error } = await this.supabase
      .from('syllabus')
      .update({
        modules: syllabus.modules,
        keywords: syllabus.keywords,
        status: 'completed',
      })
      .eq('course_configuration_id', courseId)

    if (error) {
      console.error('Error updating syllabus:', error)
      throw new Error(`Failed to update syllabus: ${error.message}`)
    }
  }

  async updateSyllabusStatus(courseId: string, status: string): Promise<void> {
    console.log(`Updating syllabus status to ${status} for course ${courseId}`)
    const { error } = await this.supabase
      .from('syllabus')
      .update({ status })
      .eq('course_configuration_id', courseId)

    if (error) {
      console.error('Error updating syllabus status:', error)
      throw new Error(`Failed to update syllabus status: ${error.message}`)
    }
  }
}