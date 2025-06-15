import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface TavusIframeDisplayProps {
  conversationUrl: string
  conversationType: 'practice' | 'exam'
  onClose: () => void
  onIframeLoad: () => void
  onIframeError: () => void
}

export function TavusIframeDisplay({
  conversationUrl,
  conversationType,
  onClose,
  onIframeLoad,
  onIframeError
}: TavusIframeDisplayProps) {
  return (
    <>
      {/* Close button overlay - positioned to not interfere with Tavus header */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/80 text-white shadow-lg backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main iframe container - full screen */}
      <div className="w-full h-full">
        <iframe
          src={conversationUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={onIframeLoad}
          onError={onIframeError}
          title={`${conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'} with AI Expert`}
        />
      </div>
    </>
  )
}