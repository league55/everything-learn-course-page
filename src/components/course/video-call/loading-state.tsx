import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  title: string
  description: string
  subDescription?: string
}

export function LoadingState({
  title,
  description,
  subDescription
}: LoadingStateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">
          {description}
        </p>
        {subDescription && (
          <div className="text-xs text-muted-foreground">
            {subDescription}
          </div>
        )}
      </Card>
    </div>
  )
} 