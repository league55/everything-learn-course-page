import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface CourseHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function CourseHeader({ sidebarCollapsed, onToggleSidebar }: CourseHeaderProps) {
  const navigate = useNavigate()

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
            onClick={() => navigate('/courses')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    </div>
  )
}