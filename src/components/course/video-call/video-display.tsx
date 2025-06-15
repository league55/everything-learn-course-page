import { DailyVideo } from '@daily-co/daily-react'
import { cn } from '@/lib/utils'

interface VideoDisplayProps {
  videoTrack: any
  isLocal: boolean
  isVideoOff: boolean
  className?: string
}

export function VideoDisplay({
  videoTrack,
  isLocal,
  isVideoOff,
  className
}: VideoDisplayProps) {
  if (!videoTrack || isVideoOff) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted rounded-lg",
        isLocal ? "w-32 h-32" : "w-full h-full",
        className
      )}>
        <div className="text-muted-foreground text-sm">
          {isLocal ? 'You' : 'Participant'}
        </div>
      </div>
    )
  }

  return (
    <DailyVideo
      videoTrack={videoTrack}
      className={cn(
        "rounded-lg object-cover",
        isLocal ? "w-32 h-32" : "w-full h-full",
        className
      )}
    />
  )
} 