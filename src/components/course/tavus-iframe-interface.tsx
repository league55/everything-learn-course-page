import { useState, useEffect, useCallback } from 'react'
import { dbOperations } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  X, 
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  MessageSquare
} from 'lucide-react'

interface TavusIframeInterfaceProps {
  conversationUrl: string
  conversationType: 'practice' | 'exam'
  conversationId: string
  onClose: () => void
  onComplete?: (transcript?: string) => void
}

export function TavusIframeInterface({
  conversationUrl,
  conversationType,
  conversationId,
  onClose,
  onComplete
}: TavusIframeInterfaceProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [transcript, setTranscript] = useState<string>('')

  console.log('TavusIframeInterface initialized:', {
    conversationUrl,
    conversationType,
    conversationId
  })

  // Subscribe to real-time updates from webhooks
  useEffect(() => {
    const subscription = dbOperations.subscribeToConversationUpdates(
      conversationId,
      (payload) => {
        console.log('Received conversation update:', payload)
        
        switch (payload.event_type) {
          case 'conversation_started':
            setIsLoading(false)
            setHasError(false)
            break
            
          case 'conversation_ended':
            setSessionEnded(true)
            setTranscript(payload.data?.transcript || '')
            break
            
          case 'conversation_failed':
            setHasError(true)
            setErrorMessage(payload.data?.error || 'Conversation failed')
            setIsLoading(false)
            break
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [conversationId])

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Tavus domains
      if (!event.origin.includes('tavus') && !event.origin.includes('daily.co')) {
        return
      }

      console.log('Received message from iframe:', event.data)

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data

        switch (data.type) {
          case 'conversation_started':
            console.log('Conversation started')
            setIsLoading(false)
            setHasError(false)
            break

          case 'conversation_ended':
            console.log('Conversation ended:', data)
            setSessionEnded(true)
            setTranscript(data.transcript || '')
            break

          case 'error':
            console.error('Iframe error:', data)
            setHasError(true)
            setErrorMessage(data.message || 'An error occurred during the conversation')
            setIsLoading(false)
            break

          case 'ready':
            console.log('Iframe ready')
            setIsLoading(false)
            break

          default:
            console.log('Unknown message type:', data.type)
        }
      } catch (error) {
        console.warn('Failed to parse iframe message:', error)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    console.log('Iframe loaded successfully')
    // Give it a moment to initialize, then hide loading if no other signals
    setTimeout(() => {
      setIsLoading(false)
    }, 3000)
  }, [])

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.error('Iframe failed to load')
    setHasError(true)
    setErrorMessage('Failed to load the conversation interface')
    setIsLoading(false)
  }, [])

  const handleManualComplete = useCallback(() => {
    console.log('User manually completing session')
    if (onComplete) {
      onComplete(transcript)
    }
  }, [onComplete, transcript])

  const handleCloseWithoutComplete = useCallback(() => {
    console.log('User closing without completing')
    onClose()
  }, [onClose])

  const isExam = conversationType === 'exam'

  // Error state
  if (hasError) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card border-2 border-destructive/20 shadow-2xl">
          <div className="p-6">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Connection Error</h3>
            </div>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mb-4">
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
          </div>
        </Card>
      </div>
    )
  }

  // Session completed state
  if (sessionEnded) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card border-2 border-green-500/20 shadow-2xl">
          <div className="p-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-semibold mb-4">Session Complete!</h3>
            <p className="text-muted-foreground mb-6">
              {isExam 
                ? 'Your oral examination has been completed successfully. Your responses have been recorded and will be reviewed.'
                : 'Great conversation! You\'ve successfully completed your practice session.'
              }
            </p>
            
            {transcript && (
              <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
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
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header with close button and status */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900/90 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Badge variant={conversationType === 'exam' ? 'destructive' : 'secondary'}>
              {conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'}
            </Badge>
            {!isLoading && (
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseWithoutComplete}
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <Card className="p-8 text-center max-w-md bg-card/95 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2 text-white">Connecting to your expert...</h3>
            <p className="text-muted-foreground mb-4">
              Please allow camera and microphone access when prompted
            </p>
            <div className="text-xs text-muted-foreground">
              This may take up to 30 seconds
            </div>
          </Card>
        </div>
      )}

      {/* Main iframe container */}
      <div className="w-full h-full pt-16">
        <iframe
          src={conversationUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={`${conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'} with AI Expert`}
        />
      </div>

      {/* Instructions overlay (shows briefly) */}
      {!isLoading && !hasError && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="bg-gray-900/90 backdrop-blur-sm border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-white font-medium mb-1">
                  {conversationType === 'exam' ? 'Examination Guidelines' : 'Conversation Tips'}
                </p>
                <p className="text-gray-300 text-xs">
                  {conversationType === 'exam' 
                    ? 'Answer questions clearly and take your time to explain your thoughts. This is your opportunity to demonstrate your knowledge.'
                    : 'Relax and enjoy discussing what you\'ve learned. Ask questions and share your thoughts freely.'
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}