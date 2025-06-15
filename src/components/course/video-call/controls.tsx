import { useMediaQuery } from '@/hooks/use-media-query'
import { ControlButtons } from './control-buttons'

interface VideoCallControlsProps {
  isMuted: boolean
  isVideoOff: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
}

export function VideoCallControls({
  isMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onEndCall
}: VideoCallControlsProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 flex justify-center gap-4 bg-background/80 p-4 backdrop-blur-sm">
        <ControlButtons
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEndCall={onEndCall}
          variant="mobile"
        />
      </div>
    )
  }

  return (
    <div className="flex justify-center gap-4 p-4">
      <ControlButtons
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onEndCall={onEndCall}
      />
    </div>
  )
} 