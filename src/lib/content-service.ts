import { supabase, dbOperations, STORAGE_BUCKETS } from './supabase'
import type { ContentItem, ContentType, ContentGenerationJob } from './supabase'

export interface ContentGenerationRequest {
  courseId: string
  moduleIndex: number
  topicIndex: number
  contentType: ContentType
  prompt: string
  title: string
  description?: string
  metadata?: Record<string, any>
}

export interface FileUploadRequest {
  courseId: string
  moduleIndex: number
  topicIndex: number
  file: File
  title: string
  description?: string
  contentType: ContentType
  metadata?: Record<string, any>
}

export class ContentService {
  // Generate file path for storage
  private generateFilePath(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    fileName: string
  ): string {
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `courses/${courseId}/module-${moduleIndex}/topic-${topicIndex}/${timestamp}-${sanitizedFileName}`
  }

  // Get storage bucket for content type
  private getStorageBucket(contentType: ContentType): string {
    switch (contentType) {
      case 'image':
        return STORAGE_BUCKETS.IMAGES
      case 'video':
        return STORAGE_BUCKETS.VIDEOS
      case 'audio':
        return STORAGE_BUCKETS.AUDIO
      case 'document':
        return STORAGE_BUCKETS.DOCUMENTS
      case 'interactive':
        return STORAGE_BUCKETS.INTERACTIVE
      default:
        return STORAGE_BUCKETS.DOCUMENTS
    }
  }

  // Upload file and create content item
  async uploadFileContent(request: FileUploadRequest): Promise<ContentItem> {
    try {
      const bucket = this.getStorageBucket(request.contentType)
      const filePath = this.generateFilePath(
        request.courseId,
        request.moduleIndex,
        request.topicIndex,
        request.file.name
      )

      // Upload file to storage
      await dbOperations.uploadFile(bucket, filePath, request.file, {
        cacheControl: '3600',
        upsert: false
      })

      // Get public URL
      const fileUrl = await dbOperations.getFileUrl(bucket, filePath)

      // Create content item record
      const contentItem = await dbOperations.createContentItem({
        course_configuration_id: request.courseId,
        module_index: request.moduleIndex,
        topic_index: request.topicIndex,
        content_type: request.contentType,
        title: request.title,
        description: request.description || null,
        content_data: {
          url: fileUrl,
          originalName: request.file.name,
          uploadedAt: new Date().toISOString()
        },
        file_path: filePath,
        file_size: request.file.size,
        mime_type: request.file.type,
        order_index: 0, // Will be updated based on existing content
        metadata: request.metadata || {}
      })

      return contentItem
    } catch (error) {
      console.error('Error uploading file content:', error)
      throw new Error(`Failed to upload file content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Create text content
  async createTextContent(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    title: string,
    content: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<ContentItem> {
    try {
      const contentItem = await dbOperations.createContentItem({
        course_configuration_id: courseId,
        module_index: moduleIndex,
        topic_index: topicIndex,
        content_type: 'text',
        title,
        description: description || null,
        content_data: {
          content,
          format: 'markdown',
          createdAt: new Date().toISOString()
        },
        file_path: null,
        file_size: null,
        mime_type: 'text/markdown',
        order_index: 0,
        metadata: metadata || {}
      })

      return contentItem
    } catch (error) {
      console.error('Error creating text content:', error)
      throw new Error(`Failed to create text content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Generate content using AI
  async generateContent(request: ContentGenerationRequest): Promise<string> {
    try {
      const jobId = await dbOperations.createContentGenerationJob(
        request.courseId,
        request.moduleIndex,
        request.topicIndex,
        request.contentType,
        request.prompt
      )

      // TODO: Trigger content generation edge function
      // For now, return the job ID
      return jobId
    } catch (error) {
      console.error('Error generating content:', error)
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get all content for a topic
  async getTopicContent(
    courseId: string,
    moduleIndex: number,
    topicIndex: number
  ): Promise<ContentItem[]> {
    try {
      return await dbOperations.getTopicContent(courseId, moduleIndex, topicIndex)
    } catch (error) {
      console.error('Error fetching topic content:', error)
      throw new Error(`Failed to fetch topic content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update content item
  async updateContent(
    contentId: string,
    updates: Partial<Pick<ContentItem, 'title' | 'description' | 'content_data' | 'metadata' | 'order_index'>>
  ): Promise<ContentItem> {
    try {
      return await dbOperations.updateContentItem(contentId, updates)
    } catch (error) {
      console.error('Error updating content:', error)
      throw new Error(`Failed to update content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Delete content item
  async deleteContent(contentId: string, filePath?: string, bucket?: string): Promise<void> {
    try {
      // Delete file from storage if it exists
      if (filePath && bucket) {
        try {
          await dbOperations.deleteFile(bucket, filePath)
        } catch (fileError) {
          console.warn('Failed to delete file from storage:', fileError)
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete content item from database
      await dbOperations.deleteContentItem(contentId)
    } catch (error) {
      console.error('Error deleting content:', error)
      throw new Error(`Failed to delete content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Reorder content items
  async reorderContent(
    courseId: string,
    moduleIndex: number,
    topicIndex: number,
    contentIds: string[]
  ): Promise<void> {
    try {
      // Update order_index for each content item
      const updatePromises = contentIds.map((contentId, index) =>
        dbOperations.updateContentItem(contentId, { order_index: index })
      )

      await Promise.all(updatePromises)
    } catch (error) {
      console.error('Error reordering content:', error)
      throw new Error(`Failed to reorder content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get content generation jobs for a course
  async getGenerationJobs(courseId: string): Promise<ContentGenerationJob[]> {
    try {
      return await dbOperations.getContentGenerationJobs(courseId)
    } catch (error) {
      console.error('Error fetching generation jobs:', error)
      throw new Error(`Failed to fetch generation jobs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Validate file for upload
  validateFile(file: File, contentType: ContentType): { valid: boolean; error?: string } {
    const maxSizes = {
      image: 10 * 1024 * 1024, // 10MB
      video: 100 * 1024 * 1024, // 100MB
      audio: 50 * 1024 * 1024, // 50MB
      document: 25 * 1024 * 1024, // 25MB
      interactive: 50 * 1024 * 1024, // 50MB
      text: 1 * 1024 * 1024 // 1MB
    }

    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      interactive: ['text/html', 'application/zip'],
      text: ['text/plain', 'text/markdown']
    }

    // Check file size
    if (file.size > maxSizes[contentType]) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${Math.round(maxSizes[contentType] / (1024 * 1024))}MB`
      }
    }

    // Check file type
    if (!allowedTypes[contentType].includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed for ${contentType} content`
      }
    }

    return { valid: true }
  }

  // Get content type from file
  getContentTypeFromFile(file: File): ContentType {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type === 'application/pdf' || file.type.includes('document')) return 'document'
    if (file.type === 'text/html' || file.type === 'application/zip') return 'interactive'
    return 'document' // Default fallback
  }
}

// Export singleton instance
export const contentService = new ContentService()