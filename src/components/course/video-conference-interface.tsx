import { useState, useEffect, useCallback, useRef } from 'react'
import { DailyProvider, useDaily, useParticipantIds, useLocalParticipant, useParticipant } from '@daily-co/daily-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  X, 
  Loader2,
  AlertTriangle,
  CheckCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoConferenceInterfaceProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onClose: () => void
  onComplete?: (transcript?: string) => void
}

interface VideoCallComponentProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onConversationEnd: () => void
  onError: (error: string) => void
  onConnected: () => void
}

// Main video call component that uses Daily hooks
function VideoCallComponent({
  roomUrl,
  conversationType,
  onConversationEnd,
  onError,
  onConnected
}: VideoCallComponentProps) {
  const daily = useDaily()
  const participantIds = useParticipantIds()
  const localParticipant = useLocalParticipant()
  
  // State management
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [callState, setCallState] = useState<'new' | 'joining' | 'joined' | 'left' | 'error'>('new')

  // Refs for cleanup tracking
  const hasJoinedRef = useRef(false)
  const cleanupRef = useRef(false)

  // Get remote participant (AI expert)
  const remoteParticipantId = participantIds.find(id => 
    id !== 'local' && (id === 'tavus-replica' || id.includes('tavus'))
  )
  const remoteParticipant = useParticipant(remoteParticipantId)

  console.log('VideoCallComponent render:', {
    roomUrl,
    conversationType,
    callState,
    isConnecting,
    isConnected,
    participantCount: participantIds.length,
    hasDaily: !!daily,
    localParticipantId: localParticipant?.user_id,
    remoteParticipantId: remoteParticipant?.user_id
  })

  // Log participant changes with detailed track information
  useEffect(() => {
    if (localParticipant) {
      console.log('👤 Local participant updated:', {
        user_id: localParticipant.user_id,
        audio: {
          state: localParticipant.tracks?.audio?.state,
          hasPersistentTrack: !!localParticipant.tracks?.audio?.persistentTrack
        },
        video: {
          state: localParticipant.tracks?.video?.state,
          hasPersistentTrack: !!localParticipant.tracks?.video?.persistentTrack
        }
      })
    }
  }, [localParticipant])

  useEffect(() => {
    if (remoteParticipant) {
      console.log('🤖 Remote participant updated:', {
        user_id: remoteParticipant.user_id,
        audio: {
          state: remoteParticipant.tracks?.audio?.state,
          hasPersistentTrack: !!remoteParticipant.tracks?.audio?.persistentTrack
        },
        video: {
          state: remoteParticipant.tracks?.video?.state,
          hasPersistentTrack: !!remoteParticipant.tracks?.video?.persistentTrack
        }
      })
    }
  }, [remoteParticipant])

  // Event handlers with proper logging
  const handleJoinedMeeting = useCallback(() => {
    console.log('✅ Successfully joined Daily meeting')
    setIsConnecting(false)
    setIsConnected(true)
    setCallState('joined')
    hasJoinedRef.current = true
    onConnected()
  }, [onConnected])

  const handleLeftMeeting = useCallback(() => {
    console.log('👋 Left Daily meeting')
    setIsConnected(false)
    setCallState('left')
    if (!cleanupRef.current) {
      onConversationEnd()
    }
  }, [onConversationEnd])

  const handleError = useCallback((error: any) => {
    console.error('❌ Daily call error:', error)
    setIsConnecting(false)
    setConnectionError(error.message || 'Connection failed')
    setCallState('error')
    onError(error.message || 'Connection failed')
  }, [onError])

  const handleParticipantJoined = useCallback((event: any) => {
    console.log('👤 Participant joined:', {
      user_id: event.participant.user_id,
      participant: event.participant
    })
  }, [])

  const handleParticipantLeft = useCallback((event: any) => {
    console.log('👤 Participant left:', event.participant.user_id)
  }, [])

  const handleParticipantUpdated = useCallback((event: any) => {
    console.log('🔄 Participant updated:', {
      user_id: event.participant.user_id,
      tracks: event.participant.tracks
    })
  }, [])

  // Initialize Daily call
  useEffect(() => {
    if (!daily || !roomUrl || hasJoinedRef.current) {
      console.log('Skipping initialization:', { hasDaily: !!daily, hasRoomUrl: !!roomUrl, hasJoined: hasJoinedRef.current })
      return
    }

    let joinTimeout: NodeJS.Timeout

    const initializeCall = async () => {
      try {
        console.log('🚀 Initializing Daily call with URL:', roomUrl)
        setCallState('joining')
        setIsConnecting(true)
        setConnectionError(null)

        // Add event listeners
        daily.on('joined-meeting', handleJoinedMeeting)
        daily.on('left-meeting', handleLeftMeeting)
        daily.on('error', handleError)
        daily.on('participant-joined', handleParticipantJoined)
        daily.on('participant-left', handleParticipantLeft)
        daily.on('participant-updated', handleParticipantUpdated)

        // Set connection timeout
        joinTimeout = setTimeout(() => {
          if (!hasJoinedRef.current) {
            console.error('⏰ Connection timeout after 30 seconds')
            handleError(new Error('Connection timeout. Please check your internet connection.'))
          }
        }, 30000)

        // Join the meeting
        console.log('📞 Attempting to join meeting...')
        await daily.join({ 
          url: roomUrl,
          startAudioOff: false,
          startVideoOff: false
        })

        console.log('✅ Join request sent successfully')

      } catch (error) {
        console.error('💥 Failed to initialize call:', error)
        setIsConnecting(false)
        if (joinTimeout) clearTimeout(joinTimeout)
        handleError(error)
      }
    }

    initializeCall()

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Daily call component')
      cleanupRef.current = true
      
      if (joinTimeout) {
        clearTimeout(joinTimeout)
      }

      if (daily) {
        try {
          // Remove event listeners
          daily.off('joined-meeting', handleJoinedMeeting)
          daily.off('left-meeting', handleLeftMeeting)
          daily.off('error', handleError)
          daily.off('participant-joined', handleParticipantJoined)
          daily.off('participant-left', handleParticipantLeft)
          daily.off('participant-updated', handleParticipantUpdated)

          // Leave the call if we joined
          if (hasJoinedRef.current && daily.meetingState() !== 'left') {
            console.log('📞 Leaving call during cleanup')
            daily.leave()
          }
        } catch (error) {
          console.error('Error during cleanup:', error)
        }
      }
    }
  }, [daily, roomUrl, handleJoinedMeeting, handleLeftMeeting, handleError, handleParticipantJoined, handleParticipantLeft, handleParticipantUpdated])

  // Control functions
  const toggleMute = useCallback(() => {
    if (!daily) return
    
    const newMuted = !isMuted
    console.log(`🎤 ${newMuted ? 'Muting' : 'Unmuting'} audio`)
    daily.setLocalAudio(!newMuted)
    setIsMuted(newMuted)
  }, [daily, isMuted])

  const toggleVideo = useCallback(() => {
    if (!daily) return
    
    const newVideoOff = !isVideoOff
    console.log(`📹 ${newVideoOff ? 'Turning off' : 'Turning on'} video`)
    daily.setLocalVideo(!newVideoOff)
    setIsVideoOff(newVideoOff)
  }, [daily, isVideoOff])

  const leaveCall = useCallback(() => {
    if (!daily) return
    
    console.log('📞 User manually leaving call')
    cleanupRef.current = true
    daily.leave()
  }, [daily])

  // Error state
  if (connectionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md border-destructive/20">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Connection Failed</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {connectionError}
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Connecting to your expert...</h3>
          <p className="text-muted-foreground mb-4">
            Please allow camera and microphone access when prompted
          </p>
          <div className="text-xs text-muted-foreground">
            This may take up to 30 seconds
          </div>
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
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Users className="h-3 w-3" />
            <span>{participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}</span>
          </div>
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
                    console.log('🎥 Setting remote video track')
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
                    console.log('🔊 Setting remote audio track')
                    el.srcObject = new MediaStream([remoteParticipant.tracks.audio.persistentTrack])
                  }
                }}
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded text-sm font-medium">
                AI Expert ({remoteParticipant.user_id})
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
                    console.log('🎥 Setting local video track')
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
                You ({localParticipant.user_id})
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

          {/* Waiting for participants */}
          {participantIds.length === 1 && (
            <Card className="col-span-full bg-gray-800 border-gray-700 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Waiting for expert to join...</h3>
              <p className="text-gray-400">Your AI expert will appear here shortly</p>
              <p className="text-xs text-gray-500 mt-2">
                Participants: {participantIds.join(', ')}
              </p>
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
            <PhoneOff className="h-5 w-5" />
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

// Main interface component with DailyProvider wrapper
export function VideoConferenceInterface({
  roomUrl,
  conversationType,
  onClose,
  onComplete
}: VideoConferenceInterfaceProps) {
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)

  console.log('VideoConferenceInterface render:', {
    roomUrl,
    conversationType,
    hasError,
    sessionEnded,
    isInitialized
  })

  // Validate room URL on mount
  useEffect(() => {
    console.log('🔍 Validating room URL:', roomUrl)
    
    if (!roomUrl) {
      console.error('❌ No room URL provided')
      setErrorMessage('No video call URL provided')
      setHasError(true)
      return
    }

    try {
      const url = new URL(roomUrl)
      console.log('✅ URL validation passed:', url.hostname)
      setIsInitialized(true)
    } catch (e) {
      console.error('❌ Invalid URL format:', e)
      setErrorMessage('Invalid video call URL format')
      setHasError(true)
      return
    }
  }, [roomUrl])

  const handleConversationEnd = useCallback((conversationTranscript?: string) => {
    console.log('🏁 Conversation ended with transcript:', conversationTranscript?.substring(0, 100))
    setTranscript(conversationTranscript || '')
    setSessionEnded(true)
  }, [])

  const handleError = useCallback((error: string) => {
    console.error('💥 Interface error:', error)
    setErrorMessage(error)
    setHasError(true)
  }, [])

  const handleConnected = useCallback(() => {
    console.log('🔗 Successfully connected to Daily room')
    setHasError(false)
  }, [])

  const handleManualComplete = useCallback(() => {
    console.log('✅ User manually completing session')
    if (onComplete) {
      onComplete(transcript)
    }
  }, [onComplete, transcript])

  const handleCloseWithoutComplete = useCallback(() => {
    console.log('❌ User closing without completing')
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

  // Don't render if not initialized
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-card shadow-2xl">
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Preparing session...</h3>
            <p className="text-muted-foreground mb-4">
              Setting up your video call
            </p>
          </div>
        </Card>
      </div>
    )
  }

  // Main interface with Daily Provider
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
        <VideoCallComponent
          roomUrl={roomUrl}
          conversationType={conversationType}
          onConversationEnd={handleConversationEnd}
          onError={handleError}
          onConnected={handleConnected}
        />
      </DailyProvider>
    </div>
  )
}