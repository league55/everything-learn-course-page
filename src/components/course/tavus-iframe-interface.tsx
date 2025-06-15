import { useState, useEffect, useCallback } from 'react'
import { dbOperations } from '@/lib/supabase'
import { ConversationCompletionModal } from './conversation-completion-modal'
import { TavusIframeLoadingOverlay } from './tavus-iframe-loading-overlay'
import { TavusIframeDisplay } from './tavus-iframe-display'
import { TavusIframeErrorState } from './tavus-iframe-error-state'

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
          tavus_conversation_id: tavusConversationId
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
        const payload = JSON.stringify({ tavus_conversation_id: tavusConversationId })
        
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
    
    // If the session ended naturally (not an error), treat it as completion
    if (sessionEnded && onComplete) {
      console.log('Session ended naturally, treating as completion')
      onComplete(transcript)
      return
    }
    
    onClose()
  }, [onClose, sessionEnded, forceEndConversation])

  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  // Error state
  if (hasError) {
    return (
      <TavusIframeErrorState
        errorMessage={errorMessage}
        onClose={handleCloseWithoutComplete}
        onRetry={handleRetry}
      />
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
      <TavusIframeLoadingOverlay isLoading={isLoading} />
      
      <TavusIframeDisplay
        conversationUrl={conversationUrl}
        conversationType={conversationType}
        onClose={handleCloseWithoutComplete}
        onIframeLoad={handleIframeLoad}
        onIframeError={handleIframeError}
      />
    </div>
  )
}