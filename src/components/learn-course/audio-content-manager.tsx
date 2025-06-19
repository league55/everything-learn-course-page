import { useState, useEffect } from 'react'
import { dbOperations } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import type { AudioGenerationJob } from '@/lib/supabase'

interface UseAudioContentResult {
  audioJob: AudioGenerationJob | null
  isGeneratingAudio: boolean
  handleGenerateAudio: (sourceText: string) => Promise<void>
}

export function useAudioContent(
  courseId: string | undefined,
  selectedModuleIndex: number,
  selectedTopicIndex: number
): UseAudioContentResult {
  const [audioJob, setAudioJob] = useState<AudioGenerationJob | null>(null)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const { toast } = useToast()

  // Load existing audio for the current topic
  useEffect(() => {
    const loadAudioData = async () => {
      if (!courseId) return

      try {
        // Use the proper dbOperations function instead of direct query
        const audioData = await dbOperations.getTopicAudio(
          courseId,
          selectedModuleIndex,
          selectedTopicIndex
        )

        if (audioData) {
          // Convert the RPC result to full AudioGenerationJob by fetching the complete record
          const { data: fullJob, error } = await dbOperations.supabase
            .from('audio_generation_jobs')
            .select('*')
            .eq('id', audioData.id)
            .single()

          if (error) {
            console.error('Error fetching full audio job:', error)
            return
          }

          setAudioJob(fullJob)
          setIsGeneratingAudio(fullJob.status === 'pending' || fullJob.status === 'processing')
        } else {
          // Check if there's a pending/processing job
          const { data: pendingJobs, error: pendingError } = await dbOperations.supabase
            .from('audio_generation_jobs')
            .select('*')
            .eq('course_configuration_id', courseId)
            .eq('module_index', selectedModuleIndex)
            .eq('topic_index', selectedTopicIndex)
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)

          if (pendingError) {
            console.error('Error checking pending jobs:', pendingError)
          } else if (pendingJobs && pendingJobs.length > 0) {
            setAudioJob(pendingJobs[0])
            setIsGeneratingAudio(true)
          } else {
            setAudioJob(null)
            setIsGeneratingAudio(false)
          }
        }

      } catch (err) {
        console.error('Failed to load audio data:', err)
        setAudioJob(null)
        setIsGeneratingAudio(false)
      }
    }

    loadAudioData()
  }, [courseId, selectedModuleIndex, selectedTopicIndex])

  // Poll for job completion
  useEffect(() => {
    if (!isGeneratingAudio || !courseId || !audioJob) return

    const pollInterval = setInterval(async () => {
      try {
        // Get the latest status of the current job
        const { data: updatedJob, error } = await dbOperations.supabase
          .from('audio_generation_jobs')
          .select('*')
          .eq('id', audioJob.id)
          .single()

        if (error) {
          console.error('Error polling audio job:', error)
          return
        }

        if (updatedJob) {
          setAudioJob(updatedJob)
          
          if (updatedJob.status === 'completed') {
            setIsGeneratingAudio(false)
            toast({
              title: "Audio Generated!",
              description: "Topic audio track has been generated successfully.",
              duration: 3000,
            })
          } else if (updatedJob.status === 'failed') {
            setIsGeneratingAudio(false)
            toast({
              title: "Audio Generation Failed",
              description: updatedJob.error_message || "Failed to generate audio. Please try again.",
              variant: "destructive",
              duration: 5000,
            })
          }
        }
      } catch (err) {
        console.error('Failed to poll audio job status:', err)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [isGeneratingAudio, courseId, audioJob, toast])

  const handleGenerateAudio = async (sourceText: string) => {
    if (!courseId || isGeneratingAudio) return

    try {
      setIsGeneratingAudio(true)
      
      // Create audio generation job using the proper dbOperations function
      const jobId = await dbOperations.createAudioGenerationJob(
        courseId,
        selectedModuleIndex,
        selectedTopicIndex,
        sourceText
      )

      // Get the created job
      const { data: createdJob, error: fetchError } = await dbOperations.supabase
        .from('audio_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      setAudioJob(createdJob)

      // Invoke the edge function to process the job
      try {
        const { data, error } = await dbOperations.supabase.functions.invoke('elevenlabs-audio-generate', {
          body: {
            job_id: jobId,
            course_configuration_id: courseId,
            module_index: selectedModuleIndex,
            topic_index: selectedTopicIndex,
            source_text: sourceText
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

      toast({
        title: "Audio Generation Started",
        description: "Generating audio track for this topic...",
        duration: 3000,
      })

    } catch (err) {
      console.error('Failed to generate audio:', err)
      setIsGeneratingAudio(false)
      toast({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "Failed to start audio generation",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  return {
    audioJob,
    isGeneratingAudio,
    handleGenerateAudio
  }
}