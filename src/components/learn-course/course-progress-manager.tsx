import { dbOperations } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import type { CourseData } from './course-data-loader'

interface UseCourseProgressResult {
  handleTopicSelect: (moduleIndex: number, topicIndex: number) => Promise<void>
  handleMarkComplete: () => Promise<void>
}

export function useCourseProgress(
  courseData: CourseData | null,
  setCourseData: React.Dispatch<React.SetStateAction<CourseData | null>>,
  selectedModuleIndex: number,
  selectedTopicIndex: number,
  setSelectedModuleIndex: (index: number) => void,
  setSelectedTopicIndex: (index: number) => void,
  setShowFinalTestButton: (show: boolean) => void,
  setCourseReadyForCompletion: (ready: boolean) => void
): UseCourseProgressResult {
  const { toast } = useToast()

  const handleTopicSelect = async (moduleIndex: number, topicIndex: number) => {
    setSelectedModuleIndex(moduleIndex)
    setSelectedTopicIndex(topicIndex)

    // Update progress if user has advanced
    if (courseData?.enrollment && moduleIndex > courseData.enrollment.current_module_index) {
      try {
        await dbOperations.updateCourseProgress(
          courseData.enrollment.id,
          moduleIndex
        )
        
        // Update local state
        setCourseData(prev => prev ? {
          ...prev,
          enrollment: {
            ...prev.enrollment,
            current_module_index: moduleIndex
          }
        } : null)

        toast({
          title: "Progress Updated",
          description: `Advanced to module ${moduleIndex + 1}`,
          duration: 2000,
        })
      } catch (err) {
        console.error('Failed to update progress:', err)
      }
    }
  }

  const handleMarkComplete = async () => {
    if (!courseData) return

    try {
      const totalModules = courseData.syllabus.modules.length
      const isLastModule = selectedModuleIndex === totalModules - 1
      const isLastTopic = selectedTopicIndex === courseData.syllabus.modules[selectedModuleIndex].topics.length - 1
      const isFinalCompletion = isLastModule && isLastTopic

      if (isFinalCompletion) {
        // Don't mark course as completed yet - just show final test button
        setCourseReadyForCompletion(true)
        setShowFinalTestButton(true)
        toast({
          title: "Course Content Completed!",
          description: "Ready for your final assessment?",
          duration: 5000,
        })
      } else {
        // Update progress to next module/topic
        const nextModuleIndex = isLastTopic ? selectedModuleIndex + 1 : selectedModuleIndex
        
        await dbOperations.updateCourseProgress(
          courseData.enrollment.id,
          nextModuleIndex
        )

        // Update local state
        setCourseData(prev => prev ? {
          ...prev,
          enrollment: {
            ...prev.enrollment,
            current_module_index: nextModuleIndex
          }
        } : null)

        // Navigate to next topic/module
        if (isLastTopic) {
          setSelectedModuleIndex(selectedModuleIndex + 1)
          setSelectedTopicIndex(0)
        } else {
          setSelectedTopicIndex(selectedTopicIndex + 1)
        }
        
        toast({
          title: isLastTopic ? "Module Completed!" : "Topic Completed!",
          description: isLastTopic ? "Moving to the next module" : "Moving to the next topic",
          duration: 3000,
        })
      }
    } catch (err) {
      console.error('Failed to mark complete:', err)
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  return {
    handleTopicSelect,
    handleMarkComplete
  }
}