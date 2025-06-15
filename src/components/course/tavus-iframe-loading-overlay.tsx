import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface TavusIframeLoadingOverlayProps {
  isLoading: boolean
}

export function TavusIframeLoadingOverlay({ isLoading }: TavusIframeLoadingOverlayProps) {
  if (!isLoading) return null

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
      <Card className="p-8 text-center max-w-md bg-card/95 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2 text-white">Connecting to your expert...</h3>
        <p className="text-muted-foreground mb-4">
          Please allow camera and microphone access when prompted
        </p>
        <div className="text-xs text-muted-foreground">
          This may take up to 30 seconds
        </div>
      </Card>
    </div>
  )
}