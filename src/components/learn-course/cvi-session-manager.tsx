import { useState } from 'react'
import { dbOperations } from '@/lib/supabase'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { generateMockExaminationResults } from '@/lib/certificate-api'
import type { CourseData } from './course-data-loader'

interface EvaluationResult {
  score: number
  breakdown: {
    conceptual_accuracy: number
    depth_of_analysis: number
    practical_application: number
  }
  strengths: string[]
  weaknesses: string[]
  impactful_quotes: string[]
  overall_assessment: string
  recommendations: string[]
}

interface UseCviSessionResult {
  showCviModal: boolean
  showCongratulationsModal: boolean
  showEvaluationModal: boolean
  conversationUrl: string | null
  conversationId: string | null
  cviConversationType: 'practice' | 'exam'
  isInitiatingCvi: boolean
  evaluationResult: EvaluationResult | null
  certificateGenerated: boolean
  certificateId: string | null
  handleInitiateTest: (conversationType: 'practice' | 'exam') => Promise<void>
  handleCviComplete: (transcript?: string) => Promise<void>
  handleCloseCvi: () => void
  handleCongratulationsClose: () => void
  handleCongratulationsComplete: () => void
  handleEvaluationClose: () => void
  handleEvaluationContinue: () => void
}

export function useCviSession(
  courseData: CourseData | null,
  selectedModuleIndex: number,
  setShowFinalTestButton: (show: boolean) => void,
  setCourseReadyForCompletion: (ready: boolean) => void
): UseCviSessionResult {
  const [showCviModal, setShowCviModal] = useState(false)
  const [showCongratulationsModal, setShowCongratulationsModal] = useState(false)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [conversationUrl, setConversationUrl] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [cviConversationType, setCviConversationType] = useState<'practice' | 'exam'>('practice')
  const [isInitiatingCvi, setIsInitiatingCvi] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null)
  const [certificateGenerated, setCertificateGenerated] = useState(false)
  const [certificateId, setCertificateId] = useState<string | null>(null)

  const { user } = useAuth()
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

      if (!response.conversation_url) {
        throw new Error('No conversation URL received from Tavus')
      }

      console.log('Setting conversation URL:', response.conversation_url)

      setConversationUrl(response.conversation_url)
      setConversationId(response.conversation_id)
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
      console.log('CVI session completed, checking for evaluation...')
      
      // Close the CVI modal first
      setShowCviModal(false)
      setConversationUrl(null)
      
      // If this is an exam, wait for evaluation results
      if (cviConversationType === 'exam' && conversationId) {
        console.log('Waiting for evaluation results for exam session...')
        
        // Poll for evaluation results
        let attempts = 0
        const maxAttempts = 30 // 30 seconds
        
        const pollForEvaluation = async (): Promise<void> => {
          try {
            const { data: conversation, error } = await dbOperations.supabase
              .from('video_conversations')
              .select('session_log, evaluation_result')
              .eq('tavus_conversation_id', conversationId)
              .single()

            if (error) {
              console.error('Failed to fetch conversation for evaluation:', error)
              throw error
            }

            const evaluationData = conversation.session_log?.evaluation_result
            
            if (evaluationData) {
              console.log('Evaluation results received:', evaluationData)
              setEvaluationResult(evaluationData)
              
              // Check if certificate was generated
              if (evaluationData.score >= 70) {
                setCertificateGenerated(true)
                // Try to get certificate ID from database
                const { data: certificates } = await dbOperations.supabase
                  .from('certificates')
                  .select('certificate_id')
                  .eq('student_id', user?.id)
                  .eq('course_id', courseData.configuration.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                
                if (certificates && certificates.length > 0) {
                  setCertificateId(certificates[0].certificate_id)
                }
              }
              
              setShowEvaluationModal(true)
              return
            }
            
            attempts++
            if (attempts < maxAttempts) {
              setTimeout(pollForEvaluation, 1000) // Poll every second
            } else {
              console.warn('Evaluation polling timeout, showing congratulations instead')
              setShowCongratulationsModal(true)
            }
            
          } catch (error) {
            console.error('Error polling for evaluation:', error)
            setShowCongratulationsModal(true)
          }
        }

        // Start polling
        pollForEvaluation()
        
      } else {
        // For practice sessions, show congratulations immediately
        setShowCongratulationsModal(true)
      }
      
      setCourseReadyForCompletion(true)

    } catch (err) {
      console.error('Failed to complete CVI session:', err)
      toast({
        title: "Error",
        description: "Failed to process session completion",
        variant: "destructive",
        duration: 3000,
      })
      
      // Fallback to congratulations modal
      setShowCongratulationsModal(true)
    }
  }

  const handleCloseCvi = () => {
    console.log('User manually closed CVI modal')
    
    // Close the CVI modal
    setShowCviModal(false)
    setConversationUrl(null)
    setConversationId(null)
    
    // Show congratulations modal for manual close
    setShowCongratulationsModal(true)
    setCourseReadyForCompletion(true)
  }

  const handleCongratulationsClose = () => {
    console.log('User closed congratulations modal without completing')
    setShowCongratulationsModal(false)
    
    // Show the final test button again if they don't want to complete
    setShowFinalTestButton(true)
  }

  const handleCongratulationsComplete = async () => {
    console.log('User chose to complete course from congratulations modal')
    
    try {
      // Mark the course as completed
      const result = await dbOperations.updateCourseProgress(
        courseData!.enrollment.id,
        selectedModuleIndex,
        true // Mark as completed
      )

      setShowCongratulationsModal(false)
      setCourseReadyForCompletion(false)
      
      // Show success message
      if (result.certificate) {
        toast({
          title: "🎓 Certificate Issued!",
          description: `Congratulations! Certificate ${result.certificate.certificateId} has been issued.`,
          duration: 8000,
        })
      } else {
        toast({
          title: "Course Completed!",
          description: "You have successfully completed the course!",
          duration: 5000,
        })
      }
      
      // Navigate back to courses after a short delay
      setTimeout(() => {
        window.location.href = 'https://everythinglearn.online/courses'
      }, 3000)

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

  const handleEvaluationClose = () => {
    console.log('User closed evaluation modal')
    setShowEvaluationModal(false)
    
    // Show congratulations modal as fallback
    setShowCongratulationsModal(true)
  }

  const handleEvaluationContinue = async () => {
    console.log('User continuing from evaluation modal')
    
    try {
      // Mark the course as completed
      const result = await dbOperations.updateCourseProgress(
        courseData!.enrollment.id,
        selectedModuleIndex,
        true // Mark as completed
      )

      setShowEvaluationModal(false)
      setCourseReadyForCompletion(false)
      
      // Show success message
      toast({
        title: "🎓 Course Completed!",
        description: "Your examination results have been recorded and your course is complete.",
        duration: 8000,
      })
      
      // Navigate back to courses after a short delay
      setTimeout(() => {
        window.location.href = 'https://everythinglearn.online/courses'
      }, 3000)

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

  return {
    showCviModal,
    showCongratulationsModal,
    showEvaluationModal,
    conversationUrl,
    conversationId,
    cviConversationType,
    isInitiatingCvi,
    evaluationResult,
    certificateGenerated,
    certificateId,
    handleInitiateTest,
    handleCviComplete,
    handleCloseCvi,
    handleCongratulationsClose,
    handleCongratulationsComplete,
    handleEvaluationClose,
    handleEvaluationContinue
  }
}