import { VideoConferenceInterface } from './video-conference-interface'

interface CviInterfaceModalProps {
  dailyRoomUrl: string
  conversationType: 'practice' | 'exam'
  onClose: () => void
  onComplete?: (transcript?: string) => void
}

/**
 * @deprecated Use VideoConferenceInterface directly instead
 * This component is kept for backward compatibility
 */
export function CviInterfaceModal({
  dailyRoomUrl,
  conversationType,
  onClose,
  onComplete
}: CviInterfaceModalProps) {
  console.log('⚠️  CviInterfaceModal is deprecated, use VideoConferenceInterface instead')
  
  return (
    <VideoConferenceInterface
      roomUrl={dailyRoomUrl}
      conversationType={conversationType}
      onClose={onClose}
      onComplete={onComplete}
    />
  )
}