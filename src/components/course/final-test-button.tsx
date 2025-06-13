import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/providers/auth-provider'
import type { CourseConfiguration, UserEnrollment } from '@/lib/supabase'
import { 
  GraduationCap, 
  MessageCircle, 
  Video, 
  Clock, 
  CheckCircle,
  Sparkles,
  Award
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FinalTestButtonProps {
  course: CourseConfiguration
  enrollment: UserEnrollment
  onTestInitiate: (conversationType: 'practice' | 'exam') => void
  isLoading?: boolean
}

export function FinalTestButton({ 
  course, 
  enrollment, 
  onTestInitiate, 
  isLoading = false 
}: FinalTestButtonProps) {
  const { user } = useAuth()
  const [selectedType, setSelectedType] = useState<'practice' | 'exam' | null>(null)

  const conversationType = course.depth <= 3 ? 'practice' : 'exam'
  const isExam = conversationType === 'exam'

  const handleInitiate = () => {
    if (selectedType) {
      onTestInitiate(selectedType)
    } else {
      onTestInitiate(conversationType)
    }
  }

  const getDepthLabel = (depth: number) => {
    const labels = {
      1: 'Beginner',
      2: 'Casual',
      3: 'Hobby',
      4: 'Academic',
      5: 'Professional'
    }
    return labels[depth as keyof typeof labels] || 'Unknown'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
            {isExam ? (
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            ) : (
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            )}
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Course Completed!
            </span>
          </div>
          
          <CardTitle className="text-2xl md:text-3xl font-bold mb-2">
            {isExam ? 'Oral Examination' : 'Practice Conversation'}
          </CardTitle>
          
          <CardDescription className="text-base md:text-lg">
            {isExam 
              ? 'Complete your learning journey with a formal assessment'
              : 'Practice what you\'ve learned in a friendly conversation'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Course Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg line-clamp-1">{course.topic}</h3>
              <Badge variant="secondary" className="text-xs">
                {getDepthLabel(course.depth)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {course.context}
            </p>
          </div>

          {/* Experience Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border/50">
              <Video className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-sm mb-1">AI Video Expert</h4>
                <p className="text-xs text-muted-foreground">
                  {isExam 
                    ? 'Professional academic examiner specialized in your field'
                    : 'Friendly expert mentor for practical discussion'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border border-border/50">
              <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-sm mb-1">Duration</h4>
                <p className="text-xs text-muted-foreground">
                  {isExam ? '15-30 minutes' : '10-15 minutes'} interactive session
                </p>
              </div>
            </div>
          </div>

          {/* What to Expect */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              What to Expect
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {isExam ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Structured questions about core concepts and principles
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Professional assessment of your understanding
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Completion certificate upon successful evaluation
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Casual discussion about practical applications
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Friendly feedback and encouragement
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    Tips for real-world implementation
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="flex-1"
              disabled={isLoading}
            >
              Maybe Later
            </Button>
            
            <Button
              onClick={handleInitiate}
              disabled={isLoading}
              className={cn(
                "flex-1 font-semibold transition-all duration-200",
                isExam
                  ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  : "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              )}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Preparing...
                </>
              ) : (
                <>
                  {isExam ? (
                    <Award className="h-4 w-4 mr-2" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-2" />
                  )}
                  {isExam ? 'Begin Examination' : 'Start Conversation'}
                </>
              )}
            </Button>
          </div>

          {/* User Info */}
          <div className="text-center pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              You'll be addressed as <span className="font-medium">{user?.email?.split('@')[0] || 'Student'}</span> during the session
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}