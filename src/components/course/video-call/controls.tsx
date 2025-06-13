import { Button } from '@/components/ui/button'
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react'

interface VideoCallControlsProps {
  isConnected: boolean
  isMuted: boolean
  isVideoOff: boolean
  conversationType: 'practice' | 'exam'
  onToggleMute: () => void
  onToggleVideo: () => void
  onLeaveCall: () => void
}

export function VideoCallControls({
  isConnected,
  isMuted,
  isVideoOff,
  conversationType,
  onToggleMute,
  onToggleVideo,
  onLeaveCall
}: VideoCallControlsProps) {
  return (
    <footer className="bg-gray-800 p-4 border-t border-gray-700">
      <div className="flex justify-center items-center gap-4">
        <Button
          onClick={onToggleMute}
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full h-12 w-12"
          disabled={!isConnected}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          onClick={onToggleVideo}
          variant={isVideoOff ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full h-12 w-12"
          disabled={!isConnected}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>

        <Button
          onClick={onLeaveCall}
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
  )
} 