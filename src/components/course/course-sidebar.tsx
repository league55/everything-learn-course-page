import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { CourseConfiguration, Syllabus, UserEnrollment } from '@/lib/supabase'
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  Circle,
  Clock,
  Target,
  Search,
  X,
  Menu,
  List
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CourseSidebarProps {
  course: CourseConfiguration
  syllabus: Syllabus
  enrollment: UserEnrollment
  selectedModuleIndex: number
  selectedTopicIndex: number
  onTopicSelect: (moduleIndex: number, topicIndex: number) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  collapsed: boolean
}

export function CourseSidebar({
  course,
  syllabus,
  enrollment,
  selectedModuleIndex,
  selectedTopicIndex,
  onTopicSelect,
  searchQuery,
  onSearchChange,
  collapsed
}: CourseSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(
    new Set([selectedModuleIndex])
  )

  const toggleModule = (moduleIndex: number) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleIndex)) {
      newExpanded.delete(moduleIndex)
    } else {
      newExpanded.add(moduleIndex)
    }
    setExpandedModules(newExpanded)
  }

  const handleTopicSelect = (moduleIndex: number, topicIndex: number) => {
    onTopicSelect(moduleIndex, topicIndex)
    setIsOpen(false) // Close sidebar on mobile after selection
  }

  const getModuleProgress = (moduleIndex: number) => {
    if (moduleIndex < enrollment.current_module_index) return 100
    if (moduleIndex === enrollment.current_module_index) return 50
    return 0
  }

  const isTopicAccessible = (moduleIndex: number) => {
    return moduleIndex <= enrollment.current_module_index
  }

  const filterTopics = (topics: any[], moduleIndex: number) => {
    if (!searchQuery) return topics
    
    return topics.filter(topic => 
      topic.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.keywords.some((keyword: string) => 
        keyword.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      topic.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const totalProgress = Math.round((enrollment.current_module_index / syllabus.modules.length) * 100)

  // Close sidebar when clicking outside (mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('course-sidebar')
      const trigger = document.getElementById('course-sidebar-trigger')
      
      if (isOpen && sidebar && trigger && 
          !sidebar.contains(event.target as Node) && 
          !trigger.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Desktop sidebar (hidden on mobile)
  const DesktopSidebar = () => (
    <div className={cn(
      "hidden md:flex flex-col h-full bg-card transition-all duration-300",
      collapsed ? "w-0 overflow-hidden" : "w-80"
    )}>
      <SidebarContent />
    </div>
  )

  // Mobile sidebar (overlay)
  const MobileSidebar = () => (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        id="course-sidebar"
        className={cn(
          'fixed left-0 top-0 z-50 h-screen bg-card border-r border-border transition-transform duration-300 ease-in-out w-80 md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Mobile Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <h2 className="font-semibold text-lg line-clamp-1">
              Course Content
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <SidebarContent />
        </div>
      </div>
    </>
  )

  // Shared sidebar content
  const SidebarContent = () => (
    <>
      {/* Course Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg line-clamp-2 mb-2 md:block hidden">
          {course.topic}
        </h2>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            <span>{syllabus.modules.length} modules</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            <span>Module {enrollment.current_module_index + 1}</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Modules List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {syllabus.modules.map((module, moduleIndex) => {
            const isExpanded = expandedModules.has(moduleIndex)
            const isAccessible = isTopicAccessible(moduleIndex)
            const progress = getModuleProgress(moduleIndex)
            const filteredTopics = filterTopics(module.topics, moduleIndex)
            
            // Hide module if search doesn't match any topics
            if (searchQuery && filteredTopics.length === 0) return null

            return (
              <Collapsible
                key={moduleIndex}
                open={isExpanded}
                onOpenChange={() => toggleModule(moduleIndex)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left p-3 h-auto",
                      selectedModuleIndex === moduleIndex && "bg-accent",
                      !isAccessible && "opacity-50"
                    )}
                    disabled={!isAccessible}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            Module {moduleIndex + 1}
                          </span>
                          {progress === 100 && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        
                        <p className="text-sm font-medium line-clamp-2">
                          {module.summary}
                        </p>
                        
                        {progress > 0 && progress < 100 && (
                          <div className="mt-2">
                            <Progress value={progress} className="h-1" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="ml-6 space-y-1">
                  {filteredTopics.map((topic, topicIndex) => {
                    const actualTopicIndex = module.topics.findIndex(t => t === topic)
                    const isSelected = selectedModuleIndex === moduleIndex && selectedTopicIndex === actualTopicIndex
                    const isTopicCompleted = moduleIndex < enrollment.current_module_index || 
                      (moduleIndex === enrollment.current_module_index && actualTopicIndex < selectedTopicIndex)

                    return (
                      <Button
                        key={actualTopicIndex}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left p-2 h-auto",
                          isSelected && "bg-primary text-primary-foreground",
                          !isAccessible && "opacity-50"
                        )}
                        onClick={() => handleTopicSelect(moduleIndex, actualTopicIndex)}
                        disabled={!isAccessible}
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="flex-shrink-0 mt-1">
                            {isTopicCompleted ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium line-clamp-2">
                              {topic.summary}
                            </p>
                            
                            {topic.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {topic.keywords.slice(0, 2).map((keyword: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                                    {keyword}
                                  </Badge>
                                ))}
                                {topic.keywords.length > 2 && (
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    +{topic.keywords.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer Info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Started {new Date(enrollment.enrolled_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </>
  )

  // Mobile trigger button (bottom navigation style)
  const MobileTrigger = () => (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border md:hidden">
      <div className="flex items-center justify-between p-4">
        {/* Course Progress Indicator */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-2 flex-1 max-w-24" />
        </div>

        {/* Sidebar Toggle Button */}
        <Button
          id="course-sidebar-trigger"
          variant="default"
          size="lg"
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 w-12 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5"
        >
          {/* Custom Course Menu Icon */}
          <div className="flex flex-col items-center justify-center gap-0.5">
            <List className="h-5 w-5" />
          </div>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <DesktopSidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar />
      
      {/* Mobile Trigger */}
      <MobileTrigger />
    </>
  )
}