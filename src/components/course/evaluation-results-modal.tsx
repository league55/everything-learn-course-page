import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConversationEvaluationDisplay } from './conversation-evaluation-display'
import { 
  X,
  Download,
  Share,
  ExternalLink
} from 'lucide-react'

interface EvaluationResult {
  score: number
  breakdown: {
    conceptual_accuracy: number
    depth_of_analysis: number
    practical_application: number
  }
  strengths: string[]
  weaknesses: string[]
  impactful_quotes: string[]
  overall_assessment: string
  recommendations: string[]
}

interface EvaluationResultsModalProps {
  evaluation: EvaluationResult
  certificateGenerated?: boolean
  certificateId?: string
  courseName: string
  onClose: () => void
  onContinue?: () => void
}

export function EvaluationResultsModal({
  evaluation,
  certificateGenerated = false,
  certificateId,
  courseName,
  onClose,
  onContinue
}: EvaluationResultsModalProps) {
  const handleShareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: `Examination Results - ${courseName}`,
        text: `I scored ${evaluation.score}/100 on my examination for "${courseName}"`,
        url: window.location.href
      })
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`I scored ${evaluation.score}/100 on my examination for "${courseName}"`)
    }
  }

  const handleDownloadResults = () => {
    // Create a simple text summary for download
    const resultsText = `
Examination Results - ${courseName}
======================================

Overall Score: ${evaluation.score}/100

Performance Breakdown:
- Conceptual Accuracy: ${evaluation.breakdown.conceptual_accuracy}/30
- Depth of Analysis: ${evaluation.breakdown.depth_of_analysis}/40
- Practical Application: ${evaluation.breakdown.practical_application}/30

Key Strengths:
${evaluation.strengths.map(s => `• ${s}`).join('\n')}

Areas for Growth:
${evaluation.weaknesses.map(w => `• ${w}`).join('\n')}

Overall Assessment:
${evaluation.overall_assessment}

Learning Recommendations:
${evaluation.recommendations.map(r => `• ${r}`).join('\n')}

${certificateGenerated ? `\nCertificate ID: ${certificateId}` : ''}
    `.trim()

    const blob = new Blob([resultsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `examination-results-${courseName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-card shadow-2xl">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="text-xl">Examination Results</CardTitle>
            <CardDescription>{courseName}</CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadResults}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareResults}
              className="flex items-center gap-2"
            >
              <Share className="h-4 w-4" />
              Share
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-y-auto p-6">
            <ConversationEvaluationDisplay
              evaluation={evaluation}
              certificateGenerated={certificateGenerated}
              certificateId={certificateId}
            />
          </div>
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">
            View Results Later
          </Button>
          
          {onContinue && (
            <Button onClick={onContinue} className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              Continue Learning
            </Button>
          )}
          
          {certificateGenerated && certificateId && (
            <Button 
              variant="secondary" 
              className="flex-1 flex items-center gap-2"
              onClick={() => window.open(`https://everythinglearn.online/certificates/${certificateId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Certificate
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}