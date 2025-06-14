import { useDailyCall } from '@/hooks/use-daily-call'
import { VideoCallHeader } from './video-call/header'
import { VideoCallControls } from './video-call/controls'
import { ParticipantVideo } from './video-call/participant-video'
import { LoadingState } from './video-call/loading-state'
import { ErrorState } from './video-call/error-state'
import { IframeVideoFallback } from './iframe-video-fallback'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface VideoCallUIProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onConversationEnd: () => void
  onError: (error: string) => void
  onConnected: () => void
}

export function VideoCallUI({
  roomUrl,
  conversationType,
  onConversationEnd,
  onError,
  onConnected
}: VideoCallUIProps) {
  const [showFallback, setShowFallback] = useState(false)
  
  const {
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
  } = useDailyCall({
    roomUrl,
    onConnected,
    onError: (error) => {
      // If it's a CORS error, show fallback instead of error state
      if (error.includes('postMessage') || error.includes('browser security')) {
        setShowFallback(true)
      } else {
        onError(error)
      }
    },
    onConversationEnd
  })

  // Show fallback after 10 seconds if still connecting
  useEffect(() => {
    if (isConnecting) {
      const timer = setTimeout(() => {
        if (isConnecting && !isConnected) {
          setShowFallback(true)
        }
      }, 10000)
      
      return () => clearTimeout(timer)
    }
  }, [isConnecting, isConnected])

  // Show fallback if CORS issues detected
  if (showFallback) {
    return (
      <IframeVideoFallback
        roomUrl={roomUrl}
        conversationType={conversationType}
        onConversationEnd={onConversationEnd}
        onError={onError}
      />
    )
  }

  // Show error state for non-CORS errors
  if (connectionError && !connectionError.includes('postMessage')) {
    return (
      <ErrorState
        error={connectionError}
        onRetry={() => window.location.reload()}
      />
    )
  }

  // Show connecting state
  if (isConnecting) {
    return (
      <LoadingState
        title="Connecting to your expert..."
        description="Please allow camera and microphone access when prompted"
        subDescription="This may take up to 30 seconds"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <VideoCallHeader
        conversationType={conversationType}
        isConnected={isConnected}
        onLeaveCall={leaveCall}
      />

      <main className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl">
          {/* Remote Participant (AI Expert) */}
          {remoteParticipant && (
            <ParticipantVideo
              participant={remoteParticipant}
              role={conversationType === 'exam' ? 'Examiner' : 'Mentor'}
            />
          )}

          {/* Local Participant (User) */}
          {localParticipant && (
            <ParticipantVideo
              participant={localParticipant}
              isLocal
              isMuted={isMuted}
              isVideoOff={isVideoOff}
            />
          )}

          {/* Show message if no participants yet */}
          {!isConnected && !remoteParticipant && (
            <Card className="col-span-full bg-gray-800 border-gray-700 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Waiting for expert to join...</h3>
              <p className="text-gray-400">Your AI expert will appear here shortly</p>
            </Card>
          )}
        </div>
      </main>

      <VideoCallControls
        isConnected={isConnected}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        conversationType={conversationType}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onLeaveCall={leaveCall}
      />
    </div>
  )
}