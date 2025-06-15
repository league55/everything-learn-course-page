import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle,
  Trophy,
  Star,
  Sparkles,
  X
} from 'lucide-react'

interface ConversationCompletionModalProps {
  conversationType: 'practice' | 'exam'
  transcript?: string
  onClose: () => void
  onContinue?: () => void
}

export function ConversationCompletionModal({
  conversationType,
  transcript,
  onClose,
  onContinue
}: ConversationCompletionModalProps) {
  const isExam = conversationType === 'exam'

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-card border-2 border-green-500/20 shadow-2xl relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader className="text-center pb-6">
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-6">
            {isExam ? (
              <Trophy className="h-10 w-10 text-white" />
            ) : (
              <CheckCircle className="h-10 w-10 text-white" />
            )}
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Session Complete!
            </span>
            <Sparkles className="h-5 w-5 text-yellow-500" />
          </div>
          
          <CardTitle className="text-2xl md:text-3xl font-bold mb-3">
            {isExam ? 'Examination Complete!' : 'Great Conversation!'}
          </CardTitle>
          
          <p className="text-muted-foreground text-base md:text-lg">
            {isExam 
              ? 'Congratulations! You\'ve successfully completed your oral examination. Your responses have been recorded and demonstrate your knowledge of the subject.'
              : 'Excellent work! You\'ve completed your practice session and engaged wonderfully with the material. Keep up the great learning!'
            }
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Achievement badges */}
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
                <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-medium">Engaged</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-xs font-medium">Completed</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-2">
                <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xs font-medium">
                {isExam ? 'Assessed' : 'Practiced'}
              </p>
            </div>
          </div>
          
          {/* Session summary */}
          {transcript && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Session Highlights
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {transcript.length > 200 ? `${transcript.substring(0, 200)}...` : transcript}
              </p>
            </div>
          )}

          {/* Next steps */}
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-sm">What's Next?</h4>
            <p className="text-xs text-muted-foreground">
              {isExam 
                ? 'Your examination results will be processed. Continue exploring more courses to expand your knowledge!'
                : 'Continue with your learning journey! Practice makes perfect, and you\'re doing great.'
              }
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              {onContinue ? 'Close Session' : 'Continue Learning'}
            </Button>
            
            {onContinue && (
              <Button onClick={onContinue} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Trophy className="h-4 w-4 mr-2" />
            {onContinue && (
              <Button onClick={onContinue} className="flex-1">
                Complete & Continue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}