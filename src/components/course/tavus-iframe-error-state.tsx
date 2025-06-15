import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface TavusIframeErrorStateProps {
  errorMessage: string
  onClose: () => void
  onRetry: () => void
}

export function TavusIframeErrorState({
  errorMessage,
  onClose,
  onRetry
}: TavusIframeErrorStateProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-card border-2 border-destructive/20 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Connection Error</h3>
          </div>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground mb-4">
            Please check your internet connection and ensure you've granted camera and microphone permissions.
          </p>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Close
            </Button>
            <Button onClick={onRetry} variant="default" className="flex-1">
              Retry
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}