import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dbOperations } from '@/lib/supabase'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import type { CourseData } from './course-data-loader'

interface UseCviSessionResult {
  showCviModal: boolean
  dailyRoomUrl: string | null
  cviConversationType: 'practice' | 'exam'
  isInitiatingCvi: boolean
  handleInitiateTest: (conversationType: 'practice' | 'exam') => Promise<void>
  handleCviComplete: (transcript?: string) => Promise<void>
  handleCloseCvi: () => void
}

export function useCviSession(
  courseData: CourseData | null,
  selectedModuleIndex: number,
  setShowFinalTestButton: (show: boolean) => void,
  setCourseReadyForCompletion: (ready: boolean) => void
): UseCviSessionResult {
  const [showCviModal, setShowCviModal] = useState(false)
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null)
  const [cviConversationType, setCviConversationType] = useState<'practice' | 'exam'>('practice')
  const [isInitiatingCvi, setIsInitiatingCvi] = useState(false)

  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleInitiateTest = async (conversationType: 'practice' | 'exam') => {
    if (!courseData || !user) return

    setIsInitiatingCvi(true)
    setCviConversationType(conversationType)

    try {
      const userName = user.email?.split('@')[0] || user.user_metadata?.name || 'Student'
      const currentModule = courseData.syllabus.modules[selectedModuleIndex]
      
      console.log('Initiating Tavus CVI session...', {
        courseId: courseData.configuration.id,
        userId: user.id,
        userName,
        courseDepth: courseData.configuration.depth,
        conversationType,
        courseTopic: courseData.configuration.topic,
        moduleSummary: currentModule.summary
      })

      const response = await dbOperations.initiateTavusCviSession(
        courseData.configuration.id,
        user.id,
        userName,
        courseData.configuration.depth,
        conversationType,
        courseData.configuration.topic,
        currentModule.summary
      )

      console.log('CVI session initiated successfully:', response)

      // Set the Daily room URL from the Tavus response
      setDailyRoomUrl(response.conversation_url)
      setShowFinalTestButton(false)
      setShowCviModal(true)

      toast({
        title: "Session Initiated",
        description: "Connecting you with your AI expert...",
        duration: 3000,
      })

    } catch (err) {
      console.error('Failed to initiate CVI session:', err)
      toast({
        title: "Connection Failed",
        description: err instanceof Error ? err.message : "Failed to start video session",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsInitiatingCvi(false)
    }
  }

  const handleCviComplete = async (transcript?: string) => {
    if (!courseData) return

    try {
      console.log('Completing course with transcript:', transcript?.substring(0, 100))

      // Mark the course as completed in the database
      await dbOperations.updateCourseProgress(
        courseData.enrollment.id,
        selectedModuleIndex,
        true // Mark as completed
      )

      setShowCviModal(false)
      setDailyRoomUrl(null)
      setCourseReadyForCompletion(false)
      
      toast({
        title: "Congratulations!",
        description: "You have successfully completed the course!",
        duration: 5000,
      })
      
      // Navigate back to courses after a short delay
      setTimeout(() => {
        navigate('/courses')
      }, 2000)

    } catch (err) {
      console.error('Failed to complete course:', err)
      toast({
        title: "Error",
        description: "Failed to mark course as completed",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  const handleCloseCvi = () => {
    setShowCviModal(false)
    setDailyRoomUrl(null)
    setShowFinalTestButton(true) // Allow them to try again
  }

  return {
    showCviModal,
    dailyRoomUrl,
    cviConversationType,
    isInitiatingCvi,
    handleInitiateTest,
    handleCviComplete,
    handleCloseCvi
  }
}