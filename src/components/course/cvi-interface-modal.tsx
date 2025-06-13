import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DailyProvider } from '@daily-co/daily-react'
import { VideoCallUI } from './video-call-ui'
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
  const [isInitialized, setIsInitialized] = useState(false)

  // Use refs to prevent race conditions and track component state
  const hasCompletedRef = useRef(false)
  const isClosingRef = useRef(false)
  const componentMountedRef = useRef(true)

  // Debug the Daily room URL
  useEffect(() => {
    console.log('CVI Modal: Daily room URL:', dailyRoomUrl)
    console.log('CVI Modal: DailyProvider about to render')
    
    // Validate the URL
    if (!dailyRoomUrl) {
      console.error('CVI Modal: No Daily room URL provided')
      setErrorMessage('No video call URL provided')
      setHasError(true)
      return
    }

    try {
      const url = new URL(dailyRoomUrl)
      console.log('CVI Modal: URL validation passed:', url.hostname)
      setIsInitialized(true)
    } catch (e) {
      console.error('CVI Modal: Invalid URL format:', e)
      setErrorMessage('Invalid video call URL format')
      setHasError(true)
      return
    }
  }, [dailyRoomUrl])

  // Check for basic browser support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('CVI Modal: Browser does not support getUserMedia')
      setErrorMessage('Your browser does not support video calls. Please use a modern browser like Chrome, Firefox, or Safari.')
      setHasError(true)
      return
    }

    // Test if we can access media devices
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const hasAudio = devices.some(device => device.kind === 'audioinput')
        const hasVideo = devices.some(device => device.kind === 'videoinput')
        console.log('CVI Modal: Media devices available:', { hasAudio, hasVideo })
        
        if (!hasAudio && !hasVideo) {
          console.warn('CVI Modal: No audio or video devices found')
        }
      })
      .catch(error => {
        console.error('CVI Modal: Error enumerating devices:', error)
      })
  }, [])

  // Set component mounted ref
  useEffect(() => {
    componentMountedRef.current = true
    return () => {
      componentMountedRef.current = false
    }
  }, [])

  const handleConversationEnd = useCallback(() => {
    if (hasCompletedRef.current || isClosingRef.current || !componentMountedRef.current) {
      console.log('CVI Modal: Ignoring conversation end - already completed or closing')
      return
    }
    
    console.log('CVI Modal: Conversation ended')
    hasCompletedRef.current = true
    setSessionEnded(true)
    setIsConnecting(false)
  }, [])

  const handleError = useCallback((error: string) => {
    if (hasCompletedRef.current || isClosingRef.current || !componentMountedRef.current) {
      console.log('CVI Modal: Ignoring error - already completed or closing')
      return
    }
    
    console.error('CVI Modal Error:', error)
    setErrorMessage(error)
    setHasError(true)
    setIsConnecting(false)
  }, [])

  const handleConnected = useCallback(() => {
    if (!componentMountedRef.current) return
    console.log('Successfully connected to Daily room')
    setIsConnecting(false)
    setHasError(false)
  }, [])

  const handleManualComplete = useCallback(() => {
    if (hasCompletedRef.current || isClosingRef.current) return
    
    console.log('User manually completing session')
    hasCompletedRef.current = true
    if (onComplete) {
      onComplete(transcript)
    }
  }, [onComplete, transcript])

  const handleCloseWithoutComplete = useCallback(() => {
    if (hasCompletedRef.current) return
    
    console.log('User closing modal without completing')
    isClosingRef.current = true
    onClose()
  }, [onClose])

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

  // Don't render DailyProvider if we don't have a valid URL or not initialized
  if (!dailyRoomUrl || !isInitialized) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card shadow-2xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Preparing session...</h3>
            <p className="text-muted-foreground mb-4">
              Setting up your video call
            </p>
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
        <VideoCallUI
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