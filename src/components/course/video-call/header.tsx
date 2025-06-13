import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone } from 'lucide-react'

interface VideoCallHeaderProps {
  conversationType: 'practice' | 'exam'
  isConnected: boolean
  onLeaveCall: () => void
}

export function VideoCallHeader({
  conversationType,
  isConnected,
  onLeaveCall
}: VideoCallHeaderProps) {
  return (
    <header className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
      <div className="flex items-center gap-3">
        <Badge variant={conversationType === 'exam' ? 'destructive' : 'secondary'}>
          {conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'}
        </Badge>
        {isConnected && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
          </div>
        )}
      </div>
      
      <Button 
        onClick={onLeaveCall}
        variant="destructive"
        size="sm"
        className="flex items-center gap-2"
      >
        <Phone className="h-4 w-4" />
        End Session
      </Button>
    </header>
  )
} 