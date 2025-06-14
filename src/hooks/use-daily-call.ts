import { useState, useCallback, useEffect } from 'react'
import { useCallFrame, useParticipantIds, useLocalParticipant, useParticipant } from '@daily-co/daily-react'

interface UseDailyCallOptions {
  roomUrl: string
  onConnected?: () => void
  onError?: (error: string) => void
  onConversationEnd?: () => void
  connectionTimeout?: number
}

interface UseDailyCallReturn {
  callFrame: ReturnType<typeof useCallFrame>
  isConnecting: boolean
  isConnected: boolean
  isMuted: boolean
  isVideoOff: boolean
  localParticipant: ReturnType<typeof useLocalParticipant>
  remoteParticipant: ReturnType<typeof useParticipant>
  connectionError: string | null
  toggleMute: () => void
  toggleVideo: () => void
  leaveCall: () => void
}

export function useDailyCall({
  roomUrl,
  onConnected,
  onError,
  onConversationEnd,
  connectionTimeout = 30000
}: UseDailyCallOptions): UseDailyCallReturn {
  const callFrame = useCallFrame()
  const participantIds = useParticipantIds()
  const localParticipant = useLocalParticipant()
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Get the first remote participant
  const remoteParticipantId = participantIds.find(id => id !== 'local')
  const remoteParticipant = useParticipant(remoteParticipantId)

  const handleError = useCallback((error: string) => {
    console.error('Daily Video error:', error)
    setConnectionError(error)
    onError?.(error)
  }, [onError])

  // Event handlers
  const handleJoinedMeeting = useCallback(() => {
    console.log('Successfully joined Daily meeting')
    setIsConnecting(false)
    setIsConnected(true)
    onConnected?.()
  }, [onConnected])

  const handleLeftMeeting = useCallback(() => {
    console.log('Left Daily meeting')
    setIsConnected(false)
    onConversationEnd?.()
  }, [onConversationEnd])

  const handleCallError = useCallback((error: any) => {
    console.error('Daily call error:', error)
    setIsConnecting(false)
    handleError(`Call error: ${error.message || 'Failed to connect to video call'}`)
  }, [handleError])

  // Initialize call when component mounts
  useEffect(() => {
    let joinTimeout: NodeJS.Timeout

    const initializeCall = async () => {
      try {
        if (!callFrame) {
          console.log('Call frame not ready yet')
          return
        }

        // Clear any existing state
        setConnectionError(null)
        setIsConnecting(true)
        setIsConnected(false)

        // Add event listeners
        callFrame.on('joined-meeting', handleJoinedMeeting)
        callFrame.on('left-meeting', handleLeftMeeting)
        callFrame.on('error', handleCallError)

        // Set a timeout for connection
        joinTimeout = setTimeout(() => {
          if (!isConnected) {
            console.error('Connection timeout - failed to join within 30 seconds')
            handleError('Connection timeout. Please check your internet connection and try again.')
          }
        }, connectionTimeout)

        console.log('Attempting to join Daily call...', { roomUrl })
        
        // Join the meeting with additional configuration for WebContainer compatibility
        await callFrame.join({ 
          url: roomUrl,
          startAudioOff: false,
          startVideoOff: false,
          // Add configuration to help with CORS issues in development
          dailyConfig: {
            // Allow iframe communication from any origin in development
            experimentalChromeVideoMuteLightOff: true,
            // Disable some features that might cause CORS issues
            enableScreenShare: false,
            enableChat: false,
            enablePeopleUI: false,
            enableNetworkUI: false,
            // Set custom CSS to ensure iframe loads properly
            customLayout: true
          }
        })

        console.log('Join request sent successfully')

      } catch (error) {
        console.error('Failed to initialize call:', error)
        setIsConnecting(false)
        if (joinTimeout) clearTimeout(joinTimeout)
        
        // Check if it's a CORS-related error
        if (error instanceof Error && error.message.includes('postMessage')) {
          handleError('Video call blocked by browser security. Please try refreshing the page or using a different browser.')
        } else {
          handleError(`Failed to join conversation: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    if (callFrame && roomUrl) {
      initializeCall()
    }

    // Cleanup function
    return () => {
      if (joinTimeout) clearTimeout(joinTimeout)
      
      if (callFrame) {
        console.log('Removing event listeners and leaving call during cleanup')
        try {
          // Remove all event listeners
          callFrame.off('joined-meeting', handleJoinedMeeting)
          callFrame.off('left-meeting', handleLeftMeeting)
          callFrame.off('error', handleCallError)
          
          // Leave the call if connected
          if (isConnected) {
            callFrame.leave()
          }
        } catch (error) {
          console.error('Error during cleanup:', error)
        }
      }
    }
  }, [callFrame, roomUrl, handleJoinedMeeting, handleLeftMeeting, handleCallError, handleError, isConnected, connectionTimeout])

  const toggleMute = useCallback(() => {
    if (!callFrame) return
    const newMuted = !isMuted
    callFrame.setLocalAudio(!newMuted)
    setIsMuted(newMuted)
  }, [callFrame, isMuted])

  const toggleVideo = useCallback(() => {
    if (!callFrame) return
    const newVideoOff = !isVideoOff
    callFrame.setLocalVideo(!newVideoOff)
    setIsVideoOff(newVideoOff)
  }, [callFrame, isVideoOff])

  const leaveCall = useCallback(() => {
    if (!callFrame) return
    console.log('User manually leaving call')
    callFrame.leave()
  }, [callFrame])

  return {
    callFrame,
    isConnecting,
    isConnected,
    isMuted,
    isVideoOff,
    localParticipant,
    remoteParticipant,
    connectionError,
    toggleMute,
    toggleVideo,
    leaveCall
  }
}