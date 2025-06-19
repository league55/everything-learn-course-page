import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'

interface CourseHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function CourseHeader({ sidebarCollapsed, onToggleSidebar }: CourseHeaderProps) {
  const handleBackToCourses = () => {
    window.location.href = 'https://everythinglearn.online/courses'
  }

  return (
    <div className="border-b border-border p-4 bg-card md:block hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToCourses}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    </div>
  )
}