import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { dbOperations } from '@/lib/supabase'
import type { CourseConfiguration, Syllabus, UserEnrollment, ContentItem, ContentGenerationJob } from '@/lib/supabase'
import { CourseSidebar } from '@/components/course/course-sidebar'
import { CourseContent } from '@/components/course/course-content'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, Search, Settings, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CourseData {
  configuration: CourseConfiguration
  syllabus: Syllabus
  enrollment: UserEnrollment
}

export function LearnCoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Content generation states
  const [topicContent, setTopicContent] = useState<ContentItem[]>([])
  const [fullContent, setFullContent] = useState<string | null>(null)
  const [isGeneratingFullContent, setIsGeneratingFullContent] = useState(false)
  const [contentGenerationJobs, setContentGenerationJobs] = useState<ContentGenerationJob[]>([])

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId) {
        setError('No course ID provided')
        setLoading(false)
        return
      }

      if (authLoading) {
        // Still checking authentication, wait
        return
      }

      if (!user) {
        setError('You must be logged in to access this course')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        console.log('Loading course data for:', courseId)
        
        // Load course configuration
        const courses = await dbOperations.getCourseConfigurations()
        const configuration = courses.find(c => c.id === courseId)
        
        if (!configuration) {
          // Try to get all courses to see if this is a public course
          const allCourses = await dbOperations.getAllCourses()
          const publicCourse = allCourses.find(c => c.id === courseId)
          
          if (!publicCourse) {
            throw new Error('Course not found')
          }
          
          // Use the public course configuration
          const publicConfiguration = {
            id: publicCourse.id,
            topic: publicCourse.topic,
            context: publicCourse.context,
            depth: publicCourse.depth,
            user_id: publicCourse.user_id,
            created_at: publicCourse.created_at,
            updated_at: publicCourse.updated_at
          }
          
          // Load syllabus
          const syllabus = await dbOperations.getSyllabus(courseId)
          
          if (!syllabus || syllabus.status !== 'completed') {
            throw new Error('Course syllabus is not ready')
          }

          // Check if user is enrolled, if not, enroll them
          let enrollment: UserEnrollment
          const enrolledCourses = await dbOperations.getUserEnrolledCourses()
          const existingEnrollment = enrolledCourses.find(ec => ec.id === courseId)?.user_enrollment
          
          if (!existingEnrollment) {
            console.log('User not enrolled, enrolling in course...')
            enrollment = await dbOperations.enrollInCourse(courseId)
            toast({
              title: "Enrolled Successfully",
              description: "You have been enrolled in this course.",
              duration: 3000,
            })
          } else {
            enrollment = existingEnrollment
          }

          setCourseData({
            configuration: publicConfiguration,
            syllabus,
            enrollment
          })

          // Set initial position based on enrollment progress
          setSelectedModuleIndex(enrollment.current_module_index || 0)
          setSelectedTopicIndex(0)
          
          return
        }

        // Load syllabus
        const syllabus = await dbOperations.getSyllabus(courseId)
        
        if (!syllabus || syllabus.status !== 'completed') {
          throw new Error('Course syllabus is not ready')
        }

        // Load user enrollment
        const enrolledCourses = await dbOperations.getUserEnrolledCourses()
        const enrollment = enrolledCourses.find(ec => ec.id === courseId)?.user_enrollment
        
        if (!enrollment) {
          // Auto-enroll the user if they're accessing their own course
          if (configuration.user_id === user.id) {
            console.log('Auto-enrolling course owner...')
            const newEnrollment = await dbOperations.enrollInCourse(courseId)
            setCourseData({
              configuration,
              syllabus,
              enrollment: newEnrollment
            })
            setSelectedModuleIndex(0)
            setSelectedTopicIndex(0)
          } else {
            throw new Error('You are not enrolled in this course')
          }
        } else {
          setCourseData({
            configuration,
            syllabus,
            enrollment
          })

          // Set initial position based on enrollment progress
          setSelectedModuleIndex(enrollment.current_module_index || 0)
          setSelectedTopicIndex(0)
        }

      } catch (err) {
        console.error('Failed to load course data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load course')
      } finally {
        setLoading(false)
      }
    }

    loadCourseData()
  }, [courseId, user, authLoading, toast])

  // Load topic content and check for ongoing generation jobs
  useEffect(() => {
    const loadTopicData = async () => {
      if (!courseData || !courseId) return

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
  }, [courseData, courseId, selectedModuleIndex, selectedTopicIndex])

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

  const handleMarkComplete = async () => {
    if (!courseData) return

    try {
      const totalModules = courseData.syllabus.modules.length
      const isLastModule = selectedModuleIndex === totalModules - 1

      await dbOperations.updateCourseProgress(
        courseData.enrollment.id,
        isLastModule ? selectedModuleIndex : selectedModuleIndex + 1,
        isLastModule
      )

      if (isLastModule) {
        toast({
          title: "Congratulations!",
          description: "You have completed the course!",
          duration: 5000,
        })
        navigate('/courses')
      } else {
        setSelectedModuleIndex(selectedModuleIndex + 1)
        setSelectedTopicIndex(0)
        
        toast({
          title: "Module Completed!",
          description: "Moving to the next module",
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

  // Show loading while checking auth or loading course
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {authLoading ? 'Checking authentication...' : 'Loading course...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {authLoading ? 'Please wait while we verify your session' : 'Preparing your learning experience'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Course data not available'}
            </AlertDescription>
          </Alert>
          <div className="flex gap-4">
            <Button 
              onClick={() => navigate('/login')}
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const currentModule = courseData.syllabus.modules[selectedModuleIndex]
  const currentTopic = currentModule?.topics[selectedTopicIndex]

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <CourseSidebar
        course={courseData.configuration}
        syllabus={courseData.syllabus}
        enrollment={courseData.enrollment}
        selectedModuleIndex={selectedModuleIndex}
        selectedTopicIndex={selectedTopicIndex}
        onTopicSelect={handleTopicSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        collapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Header */}
        <div className="border-b border-border p-4 bg-card md:block hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden pb-20 md:pb-0">
          <CourseContent
            course={courseData.configuration}
            module={currentModule}
            topic={currentTopic}
            moduleIndex={selectedModuleIndex}
            topicIndex={selectedTopicIndex}
            totalModules={courseData.syllabus.modules.length}
            enrollment={courseData.enrollment}
            fullContent={fullContent}
            onGenerateFullContent={handleGenerateFullContent}
            isGeneratingFullContent={isGeneratingFullContent}
            onMarkComplete={handleMarkComplete}
            onNavigate={handleTopicSelect}
          />
        </div>
      </div>
    </div>
  )
}