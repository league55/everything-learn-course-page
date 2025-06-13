import { VideoCallUI } from './video-call-ui'

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
  return (
    <VideoCallUI
      roomUrl={roomUrl}
      conversationType={conversationType}
      onConversationEnd={() => onConversationEnd()}
      onError={onError}
      onConnected={onConnected}
    />
  )
}