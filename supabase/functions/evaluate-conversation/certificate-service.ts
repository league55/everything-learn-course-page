import { createClient } from 'npm:@supabase/supabase-js@^2.39.1'

// TypeScript interfaces for the certification system
export interface CertificateData {
  certificateId: string
  studentId: string
  courseId: string
  courseName: string
  score: number
  maxScore: number
  examinationDate: string
  transcriptHash: string
  metadata: CertificateMetadata
  issuerAddress: string
  timestamp: number
  status: 'active' | 'revoked'
  blockchainTxId?: string
}

export interface CertificateMetadata {
  examinationType: 'quiz' | 'assessment' | 'final'
  modulesCompleted: number
  totalModules: number
  completionTime: number // in minutes
  difficultyLevel: number
  keywords: string[]
  learningObjectives: string[]
  passingScore: number
  achievementLevel: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export interface ExaminationTranscript {
  studentId: string
  courseId: string
  moduleResults: ModuleResult[]
  totalScore: number
  maxPossibleScore: number
  completionDate: string
  timeSpent: number
  examType: 'practice' | 'final'
}

export interface ModuleResult {
  moduleIndex: number
  moduleName: string
  score: number
  maxScore: number
  questionsAnswered: number
  correctAnswers: number
  timeSpent: number
  topics: TopicResult[]
}

export interface TopicResult {
  topicIndex: number
  topicName: string
  score: number
  maxScore: number
  understanding: 'poor' | 'fair' | 'good' | 'excellent'
}

// Certificate API implementation for Edge Functions
export class EdgeCertificateAPI {
  private supabase: ReturnType<typeof createClient>

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  private generateCertificateId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `CERT-${timestamp}-${random.toUpperCase()}`
  }

  private calculateTranscriptHash(transcript: ExaminationTranscript): string {
    // Simple hash calculation for transcript data
    const transcriptString = JSON.stringify(transcript)
    // Use Web Crypto API available in Deno
    const encoder = new TextEncoder()
    const data = encoder.encode(transcriptString)
    return btoa(String.fromCharCode(...data)).substring(0, 32)
  }

  private calculateAchievementLevel(score: number, maxScore: number): CertificateMetadata['achievementLevel'] {
    const percentage = (score / maxScore) * 100
    if (percentage >= 95) return 'platinum'
    if (percentage >= 85) return 'gold'
    if (percentage >= 75) return 'silver'
    return 'bronze'
  }

  private async mockBlockchainTransaction(): Promise<string> {
    // Mock blockchain transaction - in production this would interact with Algorand
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTxId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        resolve(mockTxId)
      }, 2000) // Simulate blockchain transaction time
    })
  }

  async onExaminationCompletion(
    studentId: string,
    courseId: string,
    examinationResults: ExaminationTranscript
  ): Promise<CertificateData> {
    try {
      console.log('Starting certificate issuance for:', { studentId, courseId })

      // Get course information
      const { data: course, error: courseError } = await this.supabase
        .from('course_configuration')
        .select('topic, depth')
        .eq('id', courseId)
        .single()

      if (courseError || !course) {
        throw new Error(`Failed to fetch course information: ${courseError?.message}`)
      }

      // Get user profile for Algorand address
      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('algorand_address')
        .eq('user_id', studentId)
        .single()

      // Generate certificate data
      const certificateId = this.generateCertificateId()
      const transcriptHash = this.calculateTranscriptHash(examinationResults)
      const timestamp = Date.now()
      const examinationDate = new Date().toISOString()

      const metadata: CertificateMetadata = {
        examinationType: examinationResults.examType === 'final' ? 'final' : 'assessment',
        modulesCompleted: examinationResults.moduleResults.length,
        totalModules: examinationResults.moduleResults.length,
        completionTime: examinationResults.timeSpent,
        difficultyLevel: course.depth,
        keywords: [], // Will be populated from course syllabus
        learningObjectives: [], // Will be populated from course syllabus
        passingScore: Math.ceil(examinationResults.maxPossibleScore * 0.7), // 70% passing score
        achievementLevel: this.calculateAchievementLevel(
          examinationResults.totalScore,
          examinationResults.maxPossibleScore
        )
      }

      const certificateData: CertificateData = {
        certificateId,
        studentId,
        courseId,
        courseName: course.topic,
        score: examinationResults.totalScore,
        maxScore: examinationResults.maxPossibleScore,
        examinationDate,
        transcriptHash,
        metadata,
        issuerAddress: userProfile?.algorand_address || '',
        timestamp,
        status: 'active'
      }

      // Simulate blockchain transaction
      try {
        const blockchainTxId = await this.mockBlockchainTransaction()
        certificateData.blockchainTxId = blockchainTxId
        console.log('Blockchain transaction completed:', blockchainTxId)
      } catch (blockchainError) {
        console.warn('Blockchain transaction failed, proceeding without it:', blockchainError)
      }

      // Store certificate in database
      const { data: savedCertificate, error: certificateError } = await this.supabase
        .from('certificates')
        .insert({
          certificate_id: certificateData.certificateId,
          student_id: certificateData.studentId,
          course_id: certificateData.courseId,
          course_name: certificateData.courseName,
          score: certificateData.score,
          max_score: certificateData.maxScore,
          examination_date: certificateData.examinationDate,
          transcript_hash: certificateData.transcriptHash,
          transcript_data: examinationResults,
          metadata: certificateData.metadata,
          issuer_address: certificateData.issuerAddress,
          blockchain_tx_id: certificateData.blockchainTxId,
          timestamp: certificateData.timestamp,
          status: certificateData.status
        })
        .select()
        .single()

      if (certificateError) {
        throw new Error(`Failed to save certificate: ${certificateError.message}`)
      }

      // Log certificate creation
      await this.supabase
        .from('certificate_logs')
        .insert({
          certificate_id: certificateData.certificateId,
          action: 'issued',
          details: `Certificate issued for course completion: ${course.topic}`
        })

      console.log('Certificate issued successfully:', certificateData.certificateId)
      return certificateData

    } catch (error) {
      console.error('Failed to issue certificate:', error)
      throw error
    }
  }
}

// Helper function to generate mock examination results
export function generateMockExaminationResults(
  studentId: string,
  courseId: string,
  score: number,
  maxScore: number,
  courseName: string,
  timeSpent: number = 120 // 2 hours default
): ExaminationTranscript {
  const moduleResults: ModuleResult[] = []
  
  // Create a single module result based on the evaluation
  const topics: TopicResult[] = [{
    topicIndex: 0,
    topicName: courseName,
    score: score,
    maxScore: maxScore,
    understanding: score >= 90 ? 'excellent' : 
                  score >= 80 ? 'good' : 
                  score >= 70 ? 'fair' : 'poor'
  }]

  moduleResults.push({
    moduleIndex: 0,
    moduleName: courseName,
    score: score,
    maxScore: maxScore,
    questionsAnswered: 10, // Estimated based on conversation
    correctAnswers: Math.round((score / maxScore) * 10),
    timeSpent: timeSpent,
    topics
  })

  return {
    studentId,
    courseId,
    moduleResults,
    totalScore: score,
    maxPossibleScore: maxScore,
    completionDate: new Date().toISOString(),
    timeSpent,
    examType: 'final'
  }
}

export { generateMockExaminationResults }