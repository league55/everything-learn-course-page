import { Button } from '@/components/ui/button'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'

interface ControlButtonsProps {
  isMuted: boolean
  isVideoOff: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
  variant?: 'default' | 'mobile'
}

export function ControlButtons({
  isMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  variant = 'default'
}: ControlButtonsProps) {
  const buttonSize = variant === 'mobile' ? 'icon' : 'default'
  const buttonVariant = variant === 'mobile' ? 'ghost' : 'secondary'
  const endCallVariant = variant === 'mobile' ? 'destructive' : 'default'

  return (
    <>
      <Button
        size={buttonSize}
        variant={buttonVariant}
        onClick={onToggleAudio}
        className={variant === 'mobile' ? 'h-12 w-12' : ''}
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {variant === 'default' && <span className="ml-2">{isMuted ? 'Unmute' : 'Mute'}</span>}
      </Button>

      <Button
        size={buttonSize}
        variant={buttonVariant}
        onClick={onToggleVideo}
        className={variant === 'mobile' ? 'h-12 w-12' : ''}
      >
        {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {variant === 'default' && <span className="ml-2">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>}
      </Button>

      <Button
        size={buttonSize}
        variant={endCallVariant}
        onClick={onEndCall}
        className={variant === 'mobile' ? 'h-12 w-12' : ''}
      >
        <PhoneOff className="h-4 w-4" />
        {variant === 'default' && <span className="ml-2">End Call</span>}
      </Button>
    </>
  )
} 