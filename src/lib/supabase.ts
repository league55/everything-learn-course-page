import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database schema
export interface CourseConfiguration {
  id: string
  topic: string
  context: string
  depth: number
  user_id: string
  created_at: string
  updated_at: string
}

export interface SyllabusModule {
  summary: string
  topics: SyllabusTopic[]
}

export interface SyllabusTopic {
  summary: string
  keywords: string[]
  content: string
  full_content_path?: string // Added for Phase 3
}

export interface Syllabus {
  id: string
  course_configuration_id: string
  modules: SyllabusModule[]
  keywords: string[]
  status: 'pending' | 'generating' | 'completed' | 'failed'
  created_at: string
  updated_at: string
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

export interface UserEnrollment {
  id: string
  user_id: string
  course_configuration_id: string
  enrolled_at: string
  current_module_index: number
  completed_at: string | null
  status: 'active' | 'completed' | 'dropped'
  created_at: string
  updated_at: string
}

// New content system types
export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'interactive'

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

export interface CourseWithDetails extends CourseConfiguration {
  syllabus?: Syllabus
  generation_job?: SyllabusGenerationJob
  enrollment_count?: number
  user_enrollment?: UserEnrollment
  content_items?: ContentItem[]
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  IMAGES: 'course-images',
  VIDEOS: 'course-videos',
  AUDIO: 'course-audio',
  DOCUMENTS: 'course-documents',
  INTERACTIVE: 'course-interactive'
} as const

// Database operations
export const dbOperations = {
  // Create a new course configuration
  async createCourseConfiguration(data: {
    topic: string
    context: string
    depth: number
  }): Promise<CourseConfiguration> {
    const { data: result, error } = await supabase
      .from('course_configuration')
      .insert({
        topic: data.topic,
        context: data.context,
        depth: data.depth,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create course configuration: ${error.message}`)
    }

    return result
  },

  // Get course configurations for the current user
  async getCourseConfigurations(): Promise<CourseConfiguration[]> {
    const { data, error } = await supabase
      .from('course_configuration')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch course configurations: ${error.message}`)
    }

    return data || []
  },

  // Get all public courses (for course discovery)
  async getAllCourses(limit = 50, offset = 0): Promise<CourseWithDetails[]> {
    const { data: courses, error: coursesError } = await supabase
      .from('course_configuration')
      .select(`
        *,
        syllabus!inner(*),
        syllabus_generation_jobs(*)
      `)
      .eq('syllabus.status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (coursesError) {
      throw new Error(`Failed to fetch courses: ${coursesError.message}`)
    }

    if (!courses) return []

    // Get enrollment counts for each course
    const courseIds = courses.map(course => course.id)
    const { data: enrollmentCounts, error: countError } = await supabase
      .from('user_enrollments')
      .select('course_configuration_id')
      .in('course_configuration_id', courseIds)
      .eq('status', 'active')

    if (countError) {
      console.warn('Failed to fetch enrollment counts:', countError)
    }

    // Get current user's enrollments for these courses
    const { data: userEnrollments, error: enrollmentError } = await supabase
      .from('user_enrollments')
      .select('*')
      .in('course_configuration_id', courseIds)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })

    if (enrollmentError) {
      console.warn('Failed to fetch user enrollments:', enrollmentError)
    }

    // Combine data
    return courses.map(course => {
      const enrollmentCount = enrollmentCounts?.filter(
        ec => ec.course_configuration_id === course.id
      ).length || 0

      const userEnrollment = userEnrollments?.find(
        ue => ue.course_configuration_id === course.id
      )

      return {
        ...course,
        syllabus: course.syllabus?.[0],
        generation_job: course.syllabus_generation_jobs?.[0],
        enrollment_count: enrollmentCount,
        user_enrollment: userEnrollment
      }
    })
  },

  // Get user's enrolled courses with progress
  async getUserEnrolledCourses(): Promise<CourseWithDetails[]> {
    const { data, error } = await supabase
      .from('user_enrollments')
      .select(`
        *,
        course_configuration!inner(*),
        syllabus:course_configuration!inner(syllabus(*)),
        generation_jobs:course_configuration!inner(syllabus_generation_jobs(*))
      `)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch enrolled courses: ${error.message}`)
    }

    if (!data) return []

    return data.map(enrollment => ({
      ...enrollment.course_configuration,
      syllabus: enrollment.syllabus?.syllabus?.[0],
      generation_job: enrollment.generation_jobs?.syllabus_generation_jobs?.[0],
      user_enrollment: {
        id: enrollment.id,
        user_id: enrollment.user_id,
        course_configuration_id: enrollment.course_configuration_id,
        enrolled_at: enrollment.enrolled_at,
        current_module_index: enrollment.current_module_index,
        completed_at: enrollment.completed_at,
        status: enrollment.status,
        created_at: enrollment.created_at,
        updated_at: enrollment.updated_at
      }
    }))
  },

  // Enroll user in a course
  async enrollInCourse(courseConfigurationId: string): Promise<UserEnrollment> {
    const { data, error } = await supabase
      .from('user_enrollments')
      .insert({
        course_configuration_id: courseConfigurationId,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to enroll in course: ${error.message}`)
    }

    return data
  },

  // Update user progress in a course
  async updateCourseProgress(
    enrollmentId: string, 
    moduleIndex: number,
    completed: boolean = false
  ): Promise<UserEnrollment> {
    const updateData: any = {
      current_module_index: moduleIndex
    }

    if (completed) {
      updateData.status = 'completed'
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('user_enrollments')
      .update(updateData)
      .eq('id', enrollmentId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update course progress: ${error.message}`)
    }

    return data
  },

  // Get syllabus for a course configuration
  async getSyllabus(courseConfigurationId: string): Promise<Syllabus | null> {
    const { data, error } = await supabase
      .from('syllabus')
      .select('*')
      .eq('course_configuration_id', courseConfigurationId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to fetch syllabus: ${error.message}`)
    }

    return data
  },

  // Get syllabus generation job status
  async getSyllabusGenerationJob(courseConfigurationId: string): Promise<SyllabusGenerationJob | null> {
    const { data, error } = await supabase
      .from('syllabus_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseConfigurationId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to fetch generation job: ${error.message}`)
    }

    return data
  },

  // Create initial syllabus record and enqueue generation job
  async createSyllabus(courseConfigurationId: string): Promise<{ syllabus: Syllabus; job: SyllabusGenerationJob }> {
    // Start a transaction-like operation
    try {
      // First, create the initial syllabus record
      const { data: syllabusData, error: syllabusError } = await supabase
        .from('syllabus')
        .insert({
          course_configuration_id: courseConfigurationId,
          status: 'pending'
        })
        .select()
        .single()

      if (syllabusError) {
        throw new Error(`Failed to create syllabus: ${syllabusError.message}`)
      }

      // Then, enqueue the generation job
      const { data: jobData, error: jobError } = await supabase
        .from('syllabus_generation_jobs')
        .insert({
          course_configuration_id: courseConfigurationId,
          status: 'pending'
        })
        .select()
        .single()

      if (jobError) {
        // If job creation fails, we should clean up the syllabus record
        await supabase
          .from('syllabus')
          .delete()
          .eq('id', syllabusData.id)
        
        throw new Error(`Failed to enqueue generation job: ${jobError.message}`)
      }

      // Update syllabus status to 'generating' since job is now queued
      const { data: updatedSyllabus, error: updateError } = await supabase
        .from('syllabus')
        .update({ status: 'generating' })
        .eq('id', syllabusData.id)
        .select()
        .single()

      if (updateError) {
        console.warn('Failed to update syllabus status to generating:', updateError)
      }

      return {
        syllabus: updatedSyllabus || syllabusData,
        job: jobData
      }

    } catch (error) {
      console.error('Error in createSyllabus:', error)
      throw error
    }
  },

  // Retry failed syllabus generation
  async retrySyllabusGeneration(courseConfigurationId: string): Promise<SyllabusGenerationJob> {
    // Get the existing job
    const { data: existingJob, error: fetchError } = await supabase
      .from('syllabus_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseConfigurationId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch existing job: ${fetchError.message}`)
    }

    // Check if we can retry
    if (existingJob.retries >= existingJob.max_retries) {
      throw new Error(`Maximum retries (${existingJob.max_retries}) exceeded for this job`)
    }

    // Reset job to pending status for retry
    const { data: retriedJob, error: retryError } = await supabase
      .from('syllabus_generation_jobs')
      .update({
        status: 'pending',
        error_message: null,
        started_at: null,
        completed_at: null
      })
      .eq('id', existingJob.id)
      .select()
      .single()

    if (retryError) {
      throw new Error(`Failed to retry generation job: ${retryError.message}`)
    }

    // Also update syllabus status
    await supabase
      .from('syllabus')
      .update({ status: 'generating' })
      .eq('course_configuration_id', courseConfigurationId)

    return retriedJob
  },

  // Content operations
  async getTopicContent(
    courseId: string,
    moduleIndex: number,
    topicIndex: number
  ): Promise<ContentItem[]> {
    const { data, error } = await supabase
      .rpc('get_topic_content', {
        p_course_id: courseId,
        p_module_index: moduleIndex,
        p_topic_index: topicIndex
      })

    if (error) {
      throw new Error(`Failed to fetch topic content: ${error.message}`)
    }

    return data || []
  },

  async createContentItem(contentItem: Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>): Promise<ContentItem> {
    const { data, error } = await supabase
      .from('content_items')
      .insert(contentItem)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create content item: ${error.message}`)
    }

    return data
  },

  async updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    const { data, error } = await supabase
      .from('content_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update content item: ${error.message}`)
    }

    return data
  },

  async deleteContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete content item: ${error.message}`)
    }
  },

  async createContentGenerationJob(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    contentType: ContentType,
    prompt: string
  ): Promise<string> {
    const { data, error } = await supabase
      .rpc('create_content_generation_job', {
        p_course_id: courseId,
        p_module_index: moduleIndex,
        p_topic_index: topicIndex,
        p_content_type: contentType,
        p_prompt: prompt
      })

    if (error) {
      throw new Error(`Failed to create content generation job: ${error.message}`)
    }

    return data
  },

  async getContentGenerationJobs(courseId: string): Promise<ContentGenerationJob[]> {
    const { data, error } = await supabase
      .from('content_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch content generation jobs: ${error.message}`)
    }

    return data || []
  },

  // Get content generation jobs for specific topic
  async getTopicContentGenerationJobs(
    courseId: string,
    moduleIndex: number,
    topicIndex: number
  ): Promise<ContentGenerationJob[]> {
    const { data, error } = await supabase
      .from('content_generation_jobs')
      .select('*')
      .eq('course_configuration_id', courseId)
      .eq('module_index', moduleIndex)
      .eq('topic_index', topicIndex)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch topic content generation jobs: ${error.message}`)
    }

    return data || []
  },

  // Trigger full content generation for a topic
  async triggerFullContentGeneration(
    courseId: string,
    moduleIndex: number,
    topicIndex: number
  ): Promise<string> {
    // Create a content generation job for text content
    const prompt = `Generate comprehensive learning content for this topic. Include detailed explanations, examples, and practical applications appropriate for the course depth level.`
    
    const jobId = await this.createContentGenerationJob(
      courseId,
      moduleIndex,
      topicIndex,
      'text',
      prompt
    )

    // Invoke the edge function to process the job
    try {
      const { data, error } = await supabase.functions.invoke('process-content-job', {
        body: {
          job_id: jobId,
          course_configuration_id: courseId,
          module_index: moduleIndex,
          topic_index: topicIndex,
          content_type: 'text'
        }
      })

      if (error) {
        console.warn('Failed to invoke edge function:', error)
        // Job is still created, it will be processed by the trigger
      }
    } catch (invokeError) {
      console.warn('Failed to invoke edge function:', invokeError)
      // Job is still created, it will be processed by the trigger
    }

    return jobId
  },

  // Get full content from storage
  async getFullContent(path: string): Promise<string> {
    try {
      const response = await fetch(path)
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`)
      }
      return await response.text()
    } catch (error) {
      throw new Error(`Failed to fetch full content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  // File upload operations
  async uploadFile(
    bucket: string,
    path: string,
    file: File,
    options?: { cacheControl?: string; upsert?: boolean }
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options)

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    return data.path
  },

  async getFileUrl(bucket: string, path: string): Promise<string> {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  },

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }
}