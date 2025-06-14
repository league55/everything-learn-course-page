import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ExternalLink } from 'lucide-react'

interface IframeVideoFallbackProps {
  roomUrl: string
  conversationType: 'practice' | 'exam'
  onConversationEnd: () => void
  onError: (error: string) => void
}

export function IframeVideoFallback({
  roomUrl,
  conversationType,
  onConversationEnd,
  onError
}: IframeVideoFallbackProps) {
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    // Show fallback after a short delay if the main component fails
    const timer = setTimeout(() => {
      setShowFallback(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleOpenInNewTab = () => {
    window.open(roomUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    // Assume conversation will end when they close the tab
    setTimeout(() => {
      onConversationEnd()
    }, 1000)
  }

  if (!showFallback) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-gray-800 border-gray-700 p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        
        <h2 className="text-2xl font-bold mb-4">Video Call Alternative</h2>
        
        <div className="mb-6">
          <Badge variant={conversationType === 'exam' ? 'destructive' : 'secondary'} className="mb-4">
            {conversationType === 'exam' ? 'Oral Examination' : 'Practice Session'}
          </Badge>
          
          <p className="text-gray-300 mb-4">
            Due to browser security restrictions in this development environment, 
            the video call needs to open in a new tab.
          </p>
          
          <p className="text-sm text-gray-400">
            This is normal in development environments and won't happen in production.
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={handleOpenInNewTab}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            Open Video Call in New Tab
          </Button>
          
          <Button 
            onClick={onConversationEnd}
            variant="outline"
            className="w-full"
          >
            Skip Video Call
          </Button>
        </div>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="text-sm text-gray-300 text-left space-y-1">
            <li>1. Click "Open Video Call in New Tab"</li>
            <li>2. Allow camera and microphone permissions</li>
            <li>3. Complete your {conversationType === 'exam' ? 'examination' : 'practice session'}</li>
            <li>4. Return to this tab when finished</li>
          </ol>
        </div>
      </Card>
    </div>
  )
}