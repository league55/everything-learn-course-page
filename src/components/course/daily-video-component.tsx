import { useEffect, useState, useCallback } from 'react'
import { useCallFrame, useParticipantIds, useLocalParticipant, useParticipant } from '@daily-co/daily-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyVideoProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onConversationEnd: (transcript?: string) => void
  onError: (error: string) => void
  onConnected: () => void
}

export function DailyVideo({
  roomUrl,
  conversationType,
  onConversationEnd,
  onError,
  onConnected
}: DailyVideoProps) {
  const callFrame = useCallFrame()
  const participantIds = useParticipantIds()
  const localParticipant = useLocalParticipant()
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Add debug logging helper
  const addDebugLog = useCallback((message: string) => {
    console.log('Daily Video Debug:', message)
    setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`])
  }, [])

  // Get the first remote participant (AI expert)
  const remoteParticipantId = participantIds.find(id => id !== 'local')
  const remoteParticipant = useParticipant(remoteParticipantId)

  // Debug call frame state
  useEffect(() => {
    addDebugLog(`Call frame state: ${callFrame ? 'available' : 'null'}`)
    if (callFrame) {
      addDebugLog(`Call frame meeting state: ${callFrame.meetingState()}`)
    }
  }, [callFrame, addDebugLog])

  // Debug room URL
  useEffect(() => {
    addDebugLog(`Room URL received: ${roomUrl}`)
    // Validate URL format
    try {
      const url = new URL(roomUrl)
      addDebugLog(`URL is valid: ${url.hostname}`)
    } catch (e) {
      addDebugLog(`URL is invalid: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [roomUrl, addDebugLog])

  // Stable callback using useCallback
  const handleConversationEnd = useCallback((transcript?: string) => {
    addDebugLog('Conversation ended, calling onConversationEnd')
    onConversationEnd(transcript)
  }, [onConversationEnd, addDebugLog])

  const handleError = useCallback((error: string) => {
    addDebugLog(`Error occurred: ${error}`)
    setConnectionError(error)
    onError(error)
  }, [onError, addDebugLog])

  // Event handlers
  const handleJoinedMeeting = useCallback(() => {
    addDebugLog('Successfully joined Daily meeting')
    setIsConnecting(false)
    setIsConnected(true)
    onConnected()
  }, [onConnected, addDebugLog])

  const handleLeftMeeting = useCallback(() => {
    addDebugLog('Left Daily meeting')
    setIsConnected(false)
    handleConversationEnd()
  }, [handleConversationEnd, addDebugLog])

  const handleCallError = useCallback((error: any) => {
    const errorMsg = `Call error: ${error.message || error.toString() || 'Unknown error'}`
    addDebugLog(errorMsg)
    setIsConnecting(false)
    handleError(errorMsg)
  }, [handleError, addDebugLog])

  const handleParticipantJoined = useCallback((event: any) => {
    addDebugLog(`Participant joined: ${event.participant?.user_id || 'unknown'}`)
  }, [addDebugLog])

  const handleParticipantLeft = useCallback((event: any) => {
    addDebugLog(`Participant left: ${event.participant?.user_id || 'unknown'}`)
  }, [addDebugLog])

  const handleMeetingStateChanged = useCallback((event: any) => {
    addDebugLog(`Meeting state changed: ${event.meetingState}`)
  }, [addDebugLog])

  // Initialize call when component mounts
  useEffect(() => {
    let joinTimeout: NodeJS.Timeout
    let isMounted = true

    const initializeCall = async () => {
      try {
        addDebugLog('Starting call initialization...')
        
        if (!callFrame) {
          addDebugLog('Call frame not ready yet, will retry when available')
          return
        }

        if (!roomUrl) {
          throw new Error('No room URL provided')
        }

        // Clear any existing state
        setConnectionError(null)
        setIsConnecting(true)
        setIsConnected(false)

        addDebugLog('Adding event listeners...')
        // Add event listeners
        callFrame.on('joined-meeting', handleJoinedMeeting)
        callFrame.on('left-meeting', handleLeftMeeting)
        callFrame.on('error', handleCallError)
        callFrame.on('participant-joined', handleParticipantJoined)
        callFrame.on('participant-left', handleParticipantLeft)
        callFrame.on('meeting-state-changed', handleMeetingStateChanged)

        // Set a timeout for connection
        joinTimeout = setTimeout(() => {
          if (isMounted && !isConnected) {
            addDebugLog('Connection timeout reached')
            handleError('Connection timeout. Please check your internet connection and try again.')
          }
        }, 30000) // 30 second timeout

        addDebugLog('Requesting media permissions...')
        
        // First, try to get user media to trigger permission request
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          })
          addDebugLog('Media permissions granted successfully')
          // Stop the stream since Daily will handle media
          stream.getTracks().forEach(track => track.stop())
        } catch (mediaError) {
          addDebugLog(`Media permission error: ${mediaError instanceof Error ? mediaError.message : 'Unknown error'}`)
          // Continue anyway, Daily might still work
        }

        addDebugLog('Attempting to join Daily call...')
        
        // Join the meeting
        const joinOptions = { 
          url: roomUrl,
          startAudioOff: false,
          startVideoOff: false,
          userName: 'Student'
        }
        
        addDebugLog(`Join options: ${JSON.stringify(joinOptions)}`)
        
        const result = await callFrame.join(joinOptions)
        addDebugLog(`Join result: ${JSON.stringify(result)}`)

      } catch (error) {
        addDebugLog(`Failed to initialize call: ${error instanceof Error ? error.message : 'Unknown error'}`)
        if (isMounted) {
          setIsConnecting(false)
          if (joinTimeout) clearTimeout(joinTimeout)
          handleError(`Failed to join conversation: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    if (callFrame && roomUrl) {
      initializeCall()
    }

    // Cleanup function
    return () => {
      isMounted = false
      addDebugLog('Cleaning up Daily Video component')
      if (joinTimeout) clearTimeout(joinTimeout)
      
      if (callFrame) {
        addDebugLog('Removing event listeners and leaving call during cleanup')
        try {
          // Remove all event listeners
          callFrame.off('joined-meeting', handleJoinedMeeting)
          callFrame.off('left-meeting', handleLeftMeeting)
          callFrame.off('error', handleCallError)
          callFrame.off('participant-joined', handleParticipantJoined)
          callFrame.off('participant-left', handleParticipantLeft)
          callFrame.off('meeting-state-changed', handleMeetingStateChanged)
          
          // Leave the call if connected
          if (isConnected) {
            callFrame.leave()
          }
        } catch (error) {
          addDebugLog(`Error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
  }, [
    callFrame, 
    roomUrl, 
    handleJoinedMeeting, 
    handleLeftMeeting, 
    handleCallError, 
    handleParticipantJoined,
    handleParticipantLeft,
    handleMeetingStateChanged,
    handleError, 
    isConnected,
    addDebugLog
  ])

  const toggleMute = () => {
    if (!callFrame) return

    const newMuted = !isMuted
    callFrame.setLocalAudio(!newMuted)
    setIsMuted(newMuted)
    addDebugLog(`Audio ${newMuted ? 'muted' : 'unmuted'}`)
  }

  const toggleVideo = () => {
    if (!callFrame) return

    const newVideoOff = !isVideoOff
    callFrame.setLocalVideo(!newVideoOff)
    setIsVideoOff(newVideoOff)
    addDebugLog(`Video ${newVideoOff ? 'disabled' : 'enabled'}`)
  }

  const leaveCall = () => {
    if (!callFrame) return

    addDebugLog('User manually leaving call')
    callFrame.leave()
  }

  // Show error state
  if (connectionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Connection Failed</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {connectionError}
          </p>
          
          {/* Debug information */}
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm font-medium">Debug Information</summary>
            <div className="mt-2 bg-muted p-2 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
              {debugInfo.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </details>
          
          <Button onClick={() => window.location.reload()} className="w-full mt-4">
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  // Show connecting state
  if (isConnecting || !callFrame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-lg">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Connecting to your expert...</h3>
          <p className="text-muted-foreground mb-4">
            Please allow camera and microphone access when prompted
          </p>
          <div className="text-xs text-muted-foreground mb-4">
            This may take up to 30 seconds
          </div>
          
          {/* Debug information */}
          <details className="text-left">
            <summary className="cursor-pointer text-sm font-medium">Debug Information</summary>
            <div className="mt-2 bg-muted p-2 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
              {debugInfo.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </details>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Badge variant={conversationType === 'exam' ? 'destructive' : 'secondary'}>
            {conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'}
          </Badge>
          {isConnected && (
            <div className="flex items-center gap-1 text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
        
        <Button 
          onClick={leaveCall}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <PhoneOff className="h-4 w-4" />
          End Session
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl">
          {/* Remote Participant (AI Expert) */}
          {remoteParticipant && (
            <Card className="relative bg-gray-800 border-gray-700 overflow-hidden aspect-video">
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && remoteParticipant.tracks?.video?.persistentTrack) {
                    el.srcObject = new MediaStream([remoteParticipant.tracks.video.persistentTrack])
                  }
                }}
                className="w-full h-full object-cover"
              />
              <audio
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && remoteParticipant.tracks?.audio?.persistentTrack) {
                    el.srcObject = new MediaStream([remoteParticipant.tracks.audio.persistentTrack])
                  }
                }}
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded text-sm font-medium">
                AI Expert
              </div>
              <div className="absolute top-4 right-4">
                <Badge variant="outline" className="bg-black bg-opacity-70">
                  {conversationType === 'exam' ? 'Examiner' : 'Mentor'}
                </Badge>
              </div>
            </Card>
          )}

          {/* Local Participant (User) */}
          {localParticipant && (
            <Card className="relative bg-gray-800 border-gray-700 overflow-hidden aspect-video">
              <video
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && localParticipant.tracks?.video?.persistentTrack) {
                    el.srcObject = new MediaStream([localParticipant.tracks.video.persistentTrack])
                  }
                }}
                className={cn(
                  "w-full h-full object-cover",
                  isVideoOff && "hidden"
                )}
              />
              {isVideoOff && (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <VideoOff className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded text-sm font-medium">
                You
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                {isMuted && (
                  <Badge variant="destructive" className="bg-red-600">
                    <MicOff className="h-3 w-3 mr-1" />
                    Muted
                  </Badge>
                )}
                {isVideoOff && (
                  <Badge variant="secondary" className="bg-gray-600">
                    <VideoOff className="h-3 w-3 mr-1" />
                    Camera Off
                  </Badge>
                )}
              </div>
            </Card>
          )}

          {/* Show message if no participants yet */}
          {!isConnected && participantIds.length === 0 && (
            <Card className="col-span-full bg-gray-800 border-gray-700 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Waiting for expert to join...</h3>
              <p className="text-gray-400">Your AI expert will appear here shortly</p>
            </Card>
          )}
        </div>
      </main>

      {/* Controls */}
      <footer className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex justify-center items-center gap-4">
          <Button
            onClick={toggleMute}
            variant={isMuted ? "destructive" : "secondary"}
            size="lg"
            className="rounded-full h-12 w-12"
            disabled={!isConnected}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            onClick={toggleVideo}
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            className="rounded-full h-12 w-12"
            disabled={!isConnected}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>

          <Button
            onClick={leaveCall}
            variant="destructive"
            size="lg"
            className="rounded-full h-12 w-12"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="text-center mt-4 text-sm text-gray-400">
          {conversationType === 'exam' 
            ? 'Answer questions clearly and take your time to explain your thoughts'
            : 'Relax and enjoy discussing what you\'ve learned'
          }
        </div>
      </footer>
    </div>
  )
}