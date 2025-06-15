import { useLocalParticipant, useParticipant } from '@daily-co/daily-react'
import { VideoDisplay } from './video-display'

interface ParticipantVideoProps {
  sessionId: string
}

export function ParticipantVideo({ sessionId }: ParticipantVideoProps) {
  const localParticipant = useLocalParticipant()
  const remoteParticipant = useParticipant(sessionId)

  const localVideoTrack = localParticipant?.videoTrack
  const remoteVideoTrack = remoteParticipant?.videoTrack

  return (
    <div className="relative w-full h-full">
      {/* Remote participant video (main view) */}
      <div className="w-full h-full">
        <VideoDisplay
          videoTrack={remoteVideoTrack}
          isLocal={false}
          isVideoOff={!remoteParticipant?.video}
        />
      </div>

      {/* Local participant video (picture-in-picture) */}
      <div className="absolute bottom-4 right-4">
        <VideoDisplay
          videoTrack={localVideoTrack}
          isLocal={true}
          isVideoOff={!localParticipant?.video}
        />
      </div>
    </div>
  )
} 