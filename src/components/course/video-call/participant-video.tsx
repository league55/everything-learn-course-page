import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VideoOff, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParticipantVideoProps {
  participant: any
  isLocal?: boolean
  isMuted?: boolean
  isVideoOff?: boolean
  role?: string
}

export function ParticipantVideo({
  participant,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  role
}: ParticipantVideoProps) {
  return (
    <Card className="relative bg-gray-800 border-gray-700 overflow-hidden aspect-video">
      <video
        autoPlay
        playsInline
        muted={isLocal}
        ref={(el) => {
          if (el && participant?.tracks?.video?.persistentTrack) {
            el.srcObject = new MediaStream([participant.tracks.video.persistentTrack])
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
      <audio
        autoPlay
        playsInline
        ref={(el) => {
          if (el && participant?.tracks?.audio?.persistentTrack) {
            el.srcObject = new MediaStream([participant.tracks.audio.persistentTrack])
          }
        }}
      />
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded text-sm font-medium">
        {isLocal ? 'You' : 'AI Expert'}
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
        {role && (
          <Badge variant="outline" className="bg-black bg-opacity-70">
            {role}
          </Badge>
        )}
      </div>
    </Card>
  )
} 