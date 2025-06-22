import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Quote,
  CheckCircle,
  AlertCircle,
  Award,
  BookOpen,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface ConversationEvaluationDisplayProps {
  evaluation: EvaluationResult
  certificateGenerated?: boolean
  certificateId?: string
  className?: string
}

export function ConversationEvaluationDisplay({
  evaluation,
  certificateGenerated = false,
  certificateId,
  className
}: ConversationEvaluationDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 80) return 'text-blue-600 dark:text-blue-400'
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 70) return 'Satisfactory'
    return 'Needs Improvement'
  }

  const getGradeBadgeVariant = (score: number) => {
    if (score >= 90) return 'default'
    if (score >= 80) return 'secondary'
    if (score >= 70) return 'outline'
    return 'destructive'
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Score */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl mb-2">Examination Results</CardTitle>
          <div className="space-y-2">
            <div className={cn("text-4xl font-bold", getScoreColor(evaluation.score))}>
              {evaluation.score}/100
            </div>
            <Badge variant={getGradeBadgeVariant(evaluation.score)} className="text-sm">
              {getScoreLabel(evaluation.score)}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Certificate Status */}
      {certificateGenerated && (
        <Card className="border-2 border-green-500/20 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Certificate Awarded!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {certificateId ? `Certificate ID: ${certificateId}` : 'Your certificate has been generated successfully.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Conceptual Accuracy</span>
                <span className="font-medium">{evaluation.breakdown.conceptual_accuracy}/30</span>
              </div>
              <Progress 
                value={(evaluation.breakdown.conceptual_accuracy / 30) * 100} 
                className="h-2"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Depth of Analysis</span>
                <span className="font-medium">{evaluation.breakdown.depth_of_analysis}/40</span>
              </div>
              <Progress 
                value={(evaluation.breakdown.depth_of_analysis / 40) * 100} 
                className="h-2"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Practical Application</span>
                <span className="font-medium">{evaluation.breakdown.practical_application}/30</span>
              </div>
              <Progress 
                value={(evaluation.breakdown.practical_application / 30) * 100} 
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strengths */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <TrendingUp className="h-5 w-5" />
            Key Strengths
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {evaluation.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Areas for Improvement */}
      {evaluation.weaknesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <TrendingDown className="h-5 w-5" />
              Areas for Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evaluation.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Impactful Quotes */}
      {evaluation.impactful_quotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5" />
              Notable Responses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {evaluation.impactful_quotes.map((quote, index) => (
              <blockquote key={index} className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                "{quote}"
              </blockquote>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Overall Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Overall Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{evaluation.overall_assessment}</p>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {evaluation.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Learning Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evaluation.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="text-sm">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}