import { useState, useEffect } from 'react'
import { dbOperations } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import type { ContentItem, ContentGenerationJob } from '@/lib/supabase'

interface UseTopicContentResult {
  topicContent: ContentItem[]
  fullContent: string | null
  isGeneratingFullContent: boolean
  contentGenerationJobs: ContentGenerationJob[]
  handleGenerateFullContent: () => Promise<void>
}

export function useTopicContent(
  courseId: string | undefined,
  selectedModuleIndex: number,
  selectedTopicIndex: number
): UseTopicContentResult {
  const [topicContent, setTopicContent] = useState<ContentItem[]>([])
  const [fullContent, setFullContent] = useState<string | null>(null)
  const [isGeneratingFullContent, setIsGeneratingFullContent] = useState(false)
  const [contentGenerationJobs, setContentGenerationJobs] = useState<ContentGenerationJob[]>([])
  const { toast } = useToast()

  // Load topic content and check for ongoing generation jobs
  useEffect(() => {
    const loadTopicData = async () => {
      if (!courseId) return

      try {
        // Load existing content for the current topic
        const content = await dbOperations.getTopicContent(
          courseId,
          selectedModuleIndex,
          selectedTopicIndex
        )
        setTopicContent(content)

        // Check for full content - look for text content type
        const textContent = content.find(item => item.content_type === 'text')
        if (textContent?.content_data) {
          // Parse the content_data to extract the actual content
          let extractedContent = null
          
          if (typeof textContent.content_data === 'string') {
            try {
              const parsed = JSON.parse(textContent.content_data)
              extractedContent = parsed.content || textContent.content_data
            } catch {
              extractedContent = textContent.content_data
            }
          } else if (textContent.content_data.content) {
            // If it's already an object, get the content field
            extractedContent = JSON.stringify(textContent.content_data)
          }
          
          setFullContent(extractedContent)
        } else {
          setFullContent(null)
        }

        // Load content generation jobs for this topic
        const jobs = await dbOperations.getTopicContentGenerationJobs(
          courseId,
          selectedModuleIndex,
          selectedTopicIndex
        )
        setContentGenerationJobs(jobs)

        // Check if there's an ongoing generation job
        const ongoingJob = jobs.find(job => 
          job.status === 'pending' || job.status === 'processing'
        )
        setIsGeneratingFullContent(!!ongoingJob)

      } catch (err) {
        console.error('Failed to load topic data:', err)
      }
    }

    loadTopicData()
  }, [courseId, selectedModuleIndex, selectedTopicIndex])

  // Poll for job completion
  useEffect(() => {
    if (!isGeneratingFullContent || !courseId) return

    const pollInterval = setInterval(async () => {
      try {
        const jobs = await dbOperations.getTopicContentGenerationJobs(
          courseId,
          selectedModuleIndex,
          selectedTopicIndex
        )
        
        const ongoingJob = jobs.find(job => 
          job.status === 'pending' || job.status === 'processing'
        )

        if (!ongoingJob) {
          setIsGeneratingFullContent(false)
          
          // Check if job completed successfully
          const completedJob = jobs.find(job => job.status === 'completed')
          if (completedJob) {
            // Reload topic content
            const content = await dbOperations.getTopicContent(
              courseId,
              selectedModuleIndex,
              selectedTopicIndex
            )
            setTopicContent(content)

            const textContent = content.find(item => item.content_type === 'text')
            if (textContent?.content_data) {
              // Parse the content_data properly
              let extractedContent = null
              
              if (typeof textContent.content_data === 'string') {
                try {
                  const parsed = JSON.parse(textContent.content_data)
                  extractedContent = parsed.content || textContent.content_data
                } catch {
                  extractedContent = textContent.content_data
                }
              } else if (textContent.content_data.content) {
                extractedContent = JSON.stringify(textContent.content_data)
              }
              
              if (extractedContent) {
                setFullContent(extractedContent)
                toast({
                  title: "Content Generated!",
                  description: "Full topic content has been generated successfully.",
                  duration: 3000,
                })
              }
            }
          } else {
            // Check for failed job
            const failedJob = jobs.find(job => job.status === 'failed')
            if (failedJob) {
              toast({
                title: "Generation Failed",
                description: failedJob.error_message || "Failed to generate content. Please try again.",
                variant: "destructive",
                duration: 5000,
              })
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [isGeneratingFullContent, courseId, selectedModuleIndex, selectedTopicIndex, toast])

  const handleGenerateFullContent = async () => {
    if (!courseId || isGeneratingFullContent) return

    try {
      setIsGeneratingFullContent(true)
      
      await dbOperations.triggerFullContentGeneration(
        courseId,
        selectedModuleIndex,
        selectedTopicIndex
      )

      toast({
        title: "Content Generation Started",
        description: "Generating comprehensive content for this topic...",
        duration: 3000,
      })

    } catch (err) {
      console.error('Failed to trigger content generation:', err)
      setIsGeneratingFullContent(false)
      toast({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "Failed to start content generation",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  return {
    topicContent,
    fullContent,
    isGeneratingFullContent,
    contentGenerationJobs,
    handleGenerateFullContent
  }
}