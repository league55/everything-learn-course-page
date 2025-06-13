import { VideoCallUI } from './video-call-ui'

interface TavusConversationProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onConversationEnd: (transcript?: string) => void
  onError: (error: string) => void
  onConnected: () => void
}

export function TavusConversation({
  roomUrl,
  conversationType,
  onConversationEnd,
  onError,
  onConnected
}: TavusConversationProps) {
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