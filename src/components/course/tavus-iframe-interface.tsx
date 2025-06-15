import { useState, useEffect, useCallback } from 'react'
import { dbOperations } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConversationCompletionModal } from './conversation-completion-modal'
import { 
  X, 
  Loader2,
  AlertTriangle,
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
  const [tavusConversationId, setTavusConversationId] = useState<string>(conversationId)

  console.log('TavusIframeInterface initialized:', {
    conversationUrl,
    conversationType,
    conversationId
  })

  // Force end conversation via Tavus API
  const forceEndConversation = useCallback(async () => {
    if (!tavusConversationId) {
      console.log('No Tavus conversation ID available to end')
      return
    }

    try {
      console.log('Force ending Tavus conversation:', tavusConversationId)
      
      // Call our edge function to end the conversation
      const { data, error } = await dbOperations.supabase.functions.invoke('tavus-end-conversation', {
        body: {
          conversation_id: tavusConversationId
        }
      })

      if (error) {
        console.warn('Failed to force end conversation:', error)
      } else {
        console.log('Successfully ended conversation:', data)
      }
    } catch (error) {
      console.warn('Error force ending conversation:', error)
    }
  }, [tavusConversationId])

  // Add cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (tavusConversationId && !sessionEnded) {
        // Use sendBeacon for reliable cleanup during page unload
        const endUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-end-conversation`
        const payload = JSON.stringify({ conversation_id: tavusConversationId })
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endUrl, payload)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [tavusConversationId, sessionEnded])

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

  const handleCloseWithoutComplete = useCallback(async () => {
    console.log('User closing without completing')
    
    // Force end the conversation if it's still active
    if (!sessionEnded) {
      await forceEndConversation()
    }
    
    onClose()
  }, [onClose, sessionEnded, forceEndConversation])

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
      <ConversationCompletionModal
        conversationType={conversationType}
        transcript={transcript}
        onClose={handleCloseWithoutComplete}
        onContinue={handleManualComplete}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Close button overlay - positioned to not interfere with Tavus header */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCloseWithoutComplete}
          className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/80 text-white shadow-lg backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </Button>
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

      {/* Main iframe container - full screen */}
      <div className="w-full h-full">
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
    </div>
  )
}