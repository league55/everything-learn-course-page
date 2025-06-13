import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ErrorStateProps {
  error: string
  onRetry: () => void
}

export function ErrorState({
  error,
  onRetry
}: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 text-center max-w-md">
        <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Connection Failed</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          {error}
        </p>
        <Button onClick={onRetry} className="w-full">
          Try Again
        </Button>
      </Card>
    </div>
  )
} 