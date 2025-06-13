import { useEffect, useState, useCallback, useRef } from 'react'
import { 
  useCallFrame, 
  useParticipantIds, 
  useLocalParticipant, 
  useParticipant,
  useDailyEvent,
  useNetwork,
  useDevices,
  usePermissions,
  useAudioLevel,
  DailyEvent
} from '@daily-co/daily-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX
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
  const network = useNetwork()
  const devices = useDevices()
  const permissions = usePermissions()
  const localAudioLevel = useAudioLevel(localParticipant?.session_id || '')
  
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const mountedRef = useRef(true)

  // Get the first remote participant (AI expert)
  const remoteParticipantId = participantIds.find(id => id !== 'local')
  const remoteParticipant = useParticipant(remoteParticipantId || '')

  // Stable callback using useCallback
  const handleConversationEnd = useCallback((transcript?: string) => {
    console.log('Daily Video: Conversation ended, calling onConversationEnd')
    onConversationEnd(transcript)
  }, [onConversationEnd])

  const handleError = useCallback((error: string) => {
    console.error('Daily Video error:', error)
    if (!mountedRef.current) return
    setConnectionError(error)
    onError(error)
  }, [onError])

  // Use Daily.co's event system
  useDailyEvent('joined-meeting' as DailyEvent, useCallback(() => {
    console.log('Successfully joined Daily meeting')
    if (!mountedRef.current) return
    setIsConnecting(false)
    setIsConnected(true)
    onConnected()
  }, [onConnected]))

  useDailyEvent('left-meeting' as DailyEvent, useCallback(() => {
    console.log('Left Daily meeting')
    if (!mountedRef.current) return
    setIsConnected(false)
    handleConversationEnd()
  }, [handleConversationEnd]))

  useDailyEvent('error' as DailyEvent, useCallback((error: any) => {
    console.error('Daily call error:', error)
    if (!mountedRef.current) return
    setIsConnecting(false)
    
    // Handle specific Daily.co error types
    let errorMessage = 'Failed to connect to video call'
    if (error.type === 'permission-denied') {
      errorMessage = 'Camera or microphone access was denied. Please check your permissions.'
    } else if (error.type === 'network-error') {
      errorMessage = 'Network connection error. Please check your internet connection.'
    } else if (error.type === 'device-error') {
      errorMessage = 'Error accessing camera or microphone. Please check your devices.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    handleError(errorMessage)
  }, [handleError]))

  // Initialize call when component mounts
  useEffect(() => {
    mountedRef.current = true

    const initializeCall = async () => {
      try {
        console.log('Initializing Daily call with URL:', roomUrl)
        
        if (!callFrame) {
          console.log('Call frame not ready yet')
          return
        }

        // Check permissions first
        if (!permissions.canSendAudio || !permissions.canSendVideo) {
          throw new Error('Camera and microphone permissions are required')
        }

        // Check for available devices
        if (!devices.cameras.length || !devices.microphones.length) {
          throw new Error('No camera or microphone found')
        }

        // Clear any existing state
        setConnectionError(null)
        setIsConnecting(true)
        setIsConnected(false)

        console.log('Attempting to join Daily call...')
        
        // Join the meeting
        await callFrame.join({ 
          url: roomUrl,
          startAudioOff: false,
          startVideoOff: false
        })

        console.log('Join request sent successfully')

      } catch (error) {
        console.error('Failed to initialize call:', error)
        if (!mountedRef.current) return
        setIsConnecting(false)
        handleError(`Failed to join conversation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    if (callFrame && roomUrl) {
      initializeCall()
    }

    // Cleanup function
    return () => {
      mountedRef.current = false
      console.log('Cleaning up Daily Video component')
      
      if (callFrame) {
        console.log('Leaving call during cleanup')
        try {
          if (isConnected) {
            callFrame.leave()
          }
        } catch (error) {
          console.error('Error during cleanup:', error)
        }
      }
    }
  }, [callFrame, roomUrl, handleError, isConnected, permissions, devices])

  const toggleMute = () => {
    if (!callFrame) return

    const newMuted = !isMuted
    callFrame.setLocalAudio(!newMuted)
    setIsMuted(newMuted)
  }

  const toggleVideo = () => {
    if (!callFrame) return

    const newVideoOff = !isVideoOff
    callFrame.setLocalVideo(!newVideoOff)
    setIsVideoOff(newVideoOff)
  }

  const leaveCall = () => {
    if (!callFrame) return

    console.log('User manually leaving call')
    callFrame.leave()
  }

  const retryConnection = () => {
    if (retryCount >= 3) {
      handleError('Maximum retry attempts reached. Please refresh the page.')
      return
    }
    setRetryCount(prev => prev + 1)
    setConnectionError(null)
    setIsConnecting(true)
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
          <div className="flex gap-2">
            <Button onClick={retryConnection} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
              Refresh Page
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Show connecting state
  if (isConnecting || !callFrame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
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
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </div>
              {network && (
                <div className="flex items-center gap-1 text-sm">
                  {network.quality === 'good' ? (
                    <Wifi className="h-4 w-4 text-green-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-yellow-400" />
                  )}
                  <span className={cn(
                    network.quality === 'good' ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {network.quality === 'good' ? 'Good' : 'Poor'} Connection
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={toggleMute}
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-2",
              isMuted && "text-destructive"
            )}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button 
            onClick={toggleVideo}
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-2",
              isVideoOff && "text-destructive"
            )}
          >
            {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            {isVideoOff ? 'Start Video' : 'Stop Video'}
          </Button>
          <Button 
            onClick={leaveCall}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <PhoneOff className="h-4 w-4" />
            End Session
          </Button>
        </div>
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
                muted
                className="w-full h-full object-cover"
                id={`remote-video-${remoteParticipant.session_id}`}
              />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">AI Expert</span>
                  {remoteParticipant.tracks?.audio?.state === 'playable' && (
                    <div className="flex items-center gap-1">
                      <Volume2 className="h-4 w-4" />
                      <Progress value={50} className="w-20" />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Local Participant */}
          <Card className="relative bg-gray-800 border-gray-700 overflow-hidden aspect-video">
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              id={`local-video-${localParticipant?.session_id}`}
            />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">You</span>
                {typeof localAudioLevel === 'number' && (
                  <div className="flex items-center gap-1">
                    {isMuted ? (
                      <VolumeX className="h-4 w-4 text-destructive" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                    <Progress 
                      value={isMuted ? 0 : localAudioLevel * 100} 
                      className={cn(
                        "w-20",
                        isMuted && "opacity-50"
                      )} 
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}