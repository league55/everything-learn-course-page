import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DailyProvider } from '@daily-co/daily-react'
import { DailyVideo } from './daily-video-component'
import { 
  X, 
  Video, 
  Mic, 
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CviInterfaceModalProps {
  dailyRoomUrl: string
  conversationType: 'practice' | 'exam'
  onClose: () => void
  onComplete?: (transcript?: string) => void
}

export function CviInterfaceModal({
  dailyRoomUrl,
  conversationType,
  onClose,
  onComplete
}: CviInterfaceModalProps) {
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(true)

  const handleConversationEnd = (conversationTranscript?: string) => {
    console.log('CVI Modal: Conversation ended with transcript:', conversationTranscript?.substring(0, 100))
    setTranscript(conversationTranscript || '')
    setSessionEnded(true)
    setIsConnecting(false)
  }

  const handleError = (error: string) => {
    console.error('CVI Modal Error:', error)
    setErrorMessage(error)
    setHasError(true)
    setIsConnecting(false)
  }

  const handleConnected = () => {
    console.log('Successfully connected to Daily room')
    setIsConnecting(false)
    setHasError(false)
  }

  const handleManualComplete = () => {
    console.log('User manually completing session')
    if (onComplete) {
      onComplete(transcript)
    }
  }

  const handleCloseWithoutComplete = () => {
    console.log('User closing modal without completing')
    onClose()
  }

  const isExam = conversationType === 'exam'

  // Error state
  if (hasError) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card border-2 border-destructive/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Please check your internet connection and ensure you've granted camera and microphone permissions.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleCloseWithoutComplete} variant="outline" className="flex-1">
                Close
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="default" 
                className="flex-1"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Session completed state
  if (sessionEnded) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card border-2 border-green-500/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-muted-foreground">
              {isExam 
                ? 'Your oral examination has been completed successfully. Your responses have been recorded and will be reviewed.'
                : 'Great conversation! You\'ve successfully completed your practice session.'
              }
            </p>
            
            {transcript && (
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <h4 className="font-semibold mb-2 text-sm">Session Summary</h4>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {transcript.length > 200 ? `${transcript.substring(0, 200)}...` : transcript}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button onClick={handleCloseWithoutComplete} variant="outline" className="flex-1">
                Close Session
              </Button>
              <Button onClick={handleManualComplete} className="flex-1">
                Complete & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card shadow-2xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Connecting to your expert...</h3>
            <p className="text-muted-foreground mb-4">
              Please allow camera and microphone access when prompted
            </p>
            <div className="text-xs text-muted-foreground">
              This may take up to 30 seconds
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main conversation interface with Daily Provider
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button overlay */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCloseWithoutComplete}
          className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Daily Provider wraps the video component */}
      <DailyProvider>
        <DailyVideo
          roomUrl={dailyRoomUrl}
          conversationType={conversationType}
          onConversationEnd={handleConversationEnd}
          onError={handleError}
          onConnected={handleConnected}
        />
      </DailyProvider>
    </div>
  )
}