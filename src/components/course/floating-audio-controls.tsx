import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AudioPlayer } from './audio-player'
import { useAudioContent } from '@/components/learn-course/audio-content-manager'
import { useToast } from '@/hooks/use-toast'
import { 
  Volume2, 
  X, 
  ChevronUp, 
  ChevronDown,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingAudioControlsProps {
  courseId: string
  moduleIndex: number
  topicIndex: number
  topicContent: string
  fullContent?: string | null
  className?: string
}

export function FloatingAudioControls({
  courseId,
  moduleIndex,
  topicIndex,
  topicContent,
  fullContent,
  className
}: FloatingAudioControlsProps) {
  const { toast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Audio content management
  const {
    audioJob,
    isGeneratingAudio,
    handleGenerateAudio
  } = useAudioContent(courseId, moduleIndex, topicIndex)

  // Auto-show when audio is available or generating
  useEffect(() => {
    if (audioJob || isGeneratingAudio) {
      setIsVisible(true)
      if (audioJob?.status === 'completed') {
        setIsExpanded(true)
      }
    }
  }, [audioJob, isGeneratingAudio])

  // Get text content for audio generation with intelligent selection
  const getTextForAudio = () => {
    // Try to parse fullContent if it's JSON
    if (fullContent) {
      try {
        const parsed = JSON.parse(fullContent)
        if (parsed.content && parsed.content.length > 200) {
          return parsed.content
        }
      } catch {
        // If not JSON, use as-is if substantial
        if (fullContent.length > 200) {
          return fullContent
        }
      }
    }
    
    // Fall back to topic overview
    return topicContent
  }

  const handleAudioGeneration = () => {
    const textContent = getTextForAudio()
    
    // Check if the content is very short and warn user
    if (textContent.length < 200) {
      toast({
        title: "Short Content Warning",
        description: "The current content is quite brief. Consider generating comprehensive content first for a more detailed audio track.",
        variant: "default",
        duration: 5000,
      })
    }
    
    // Check if using topic overview vs comprehensive content
    const isUsingOverview = !fullContent || fullContent.length <= 200
    if (isUsingOverview) {
      toast({
        title: "Using Topic Overview",
        description: "Audio will be generated from the topic overview. For a more detailed track, generate comprehensive content first.",
        variant: "default",
        duration: 4000,
      })
    }

    handleGenerateAudio(textContent)
    setIsVisible(true)
    setIsExpanded(true)
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  // Don't render if not visible and no audio/generation
  if (!isVisible && !audioJob && !isGeneratingAudio) {
    return null
  }

  // Show generate button when no audio exists
  if (!audioJob && !isGeneratingAudio) {
    return (
      <div className={cn("fixed top-20 right-6 z-50", className)}>
        <Card className="bg-card/95 backdrop-blur-sm border shadow-lg">
          <div className="p-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAudioGeneration}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
              >
                {/* ElevenLabs Logo */}
                <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-sm flex items-center justify-center">
                    <div className="text-white text-xs font-bold leading-none">11</div>
                  </div>
                </div>
                <Volume2 className="h-4 w-4" />
                Generate Audio
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Info about content source */}
            {!fullContent && (
              <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-medium">From Topic Overview</p>
                  <p>Generate comprehensive content for a detailed audio track</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // Show audio player or generation status
  return (
    <div className={cn("fixed top-20 right-6 z-50", className)}>
      <Card className="bg-card/95 backdrop-blur-sm border shadow-lg min-w-80 max-w-96">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center">
              <div className="w-3 h-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-sm flex items-center justify-center">
                <div className="text-white text-xs font-bold leading-none">11</div>
              </div>
            </div>
            <span className="text-sm font-medium">Topic Audio</span>
            <Badge variant="secondary" className="text-xs">
              M{moduleIndex + 1}T{topicIndex + 1}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-3">
            {isGeneratingAudio ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">Generating audio track...</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  This may take a few moments. The audio will start playing automatically when ready.
                </div>
              </div>
            ) : audioJob?.status === 'completed' && audioJob.audio_file_path ? (
              <div className="space-y-3">
                <AudioPlayer
                  audioUrl={audioJob.audio_file_path}
                  duration={audioJob.duration_seconds || undefined}
                  className="border-0 bg-transparent p-0"
                />
                
                {/* Audio Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {audioJob.audio_file_size ? 
                      `${Math.round(audioJob.audio_file_size / 1024)} KB` : 
                      'Audio track'
                    }
                  </span>
                  {audioJob.duration_seconds && (
                    <span>{Math.round(audioJob.duration_seconds / 60)} min</span>
                  )}
                </div>
              </div>
            ) : audioJob?.status === 'failed' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Generation failed</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {audioJob.error_message || 'Unknown error occurred'}
                </div>
                <Button
                  onClick={handleAudioGeneration}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* Collapsed state indicator */}
        {!isExpanded && (audioJob?.status === 'completed' || isGeneratingAudio) && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isGeneratingAudio ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3 w-3" />
                  <span>Ready to play</span>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}