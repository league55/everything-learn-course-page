import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Import our new components
import { useCourseData } from '@/components/learn-course/course-data-loader'
import { useTopicContent } from '@/components/learn-course/topic-content-manager'
import { useCourseProgress } from '@/components/learn-course/course-progress-manager'
import { useCviSession } from '@/components/learn-course/cvi-session-manager'
import { CourseHeader } from '@/components/learn-course/course-header'

// Import existing components
import { CourseSidebar } from '@/components/course/course-sidebar'
import { CourseContent } from '@/components/course/course-content'
import { FinalTestButton } from '@/components/course/final-test-button'
import { CviInterfaceModal } from '@/components/course/cvi-interface-modal'

export function LearnCoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  // Navigation state
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // UI state managed by parent component
  const [showFinalTestButton, setShowFinalTestButton] = useState(false)
  const [courseReadyForCompletion, setCourseReadyForCompletion] = useState(false)

  // Load course data
  const { courseData, setCourseData, loading, error } = useCourseData(courseId)

  // Set initial position based on enrollment progress
  useEffect(() => {
    if (courseData?.enrollment) {
      setSelectedModuleIndex(courseData.enrollment.current_module_index || 0)
      setSelectedTopicIndex(0)
    }
  }, [courseData])

  // Load topic content
  const {
    topicContent,
    fullContent,
    isGeneratingFullContent,
    contentGenerationJobs,
    handleGenerateFullContent
  } = useTopicContent(courseId, selectedModuleIndex, selectedTopicIndex)

  // Manage course progress
  const {
    handleTopicSelect,
    handleMarkComplete
  } = useCourseProgress(
    courseData,
    setCourseData,
    selectedModuleIndex,
    selectedTopicIndex,
    setSelectedModuleIndex,
    setSelectedTopicIndex,
    setShowFinalTestButton,
    setCourseReadyForCompletion
  )

  // Manage CVI sessions
  const {
    showCviModal,
    dailyRoomUrl,
    cviConversationType,
    isInitiatingCvi,
    handleInitiateTest,
    handleCviComplete,
    handleCloseCvi
  } = useCviSession(
    courseData,
    selectedModuleIndex,
    setShowFinalTestButton,
    setCourseReadyForCompletion
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading course...</span>
        </div>
      </div>
    )
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription>{error || 'Course data not available'}</AlertDescription>
          </Alert>
          <Button 
            className="mt-4" 
            onClick={() => navigate('/courses')}
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
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
        searchQuery=""
        onSearchChange={() => {}}
        collapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Header */}
        <CourseHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

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

      {/* Final Test Button Modal */}
      {showFinalTestButton && courseData && (
        <FinalTestButton
          course={courseData.configuration}
          enrollment={courseData.enrollment}
          onTestInitiate={handleInitiateTest}
          isLoading={isInitiatingCvi}
        />
      )}

      {/* CVI Interface Modal */}
      {showCviModal && dailyRoomUrl && (
        <CviInterfaceModal
          dailyRoomUrl={dailyRoomUrl}
          conversationType={cviConversationType}
          onClose={handleCloseCvi}
          onComplete={handleCviComplete}
        />
      )}
    </div>
  )
}