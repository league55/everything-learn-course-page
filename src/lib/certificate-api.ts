// Certificate API service for blockchain integration
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

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

export interface CertificateVerificationResult {
  isValid: boolean
  certificateData?: CertificateData
  error?: string
  verificationTimestamp: number
  blockchainConfirmed: boolean
}

export interface BlockchainConfig {
  network: 'mainnet' | 'testnet' | 'sandbox'
  algodServer: string
  algodPort: number
  algodToken: string
  appId: number
  creatorAddress: string
  creatorMnemonic: string
}

// Certificate API implementation
class CertificateAPI {
  private generateCertificateId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `CERT-${timestamp}-${random.toUpperCase()}`
  }

  private calculateTranscriptHash(transcript: ExaminationTranscript): string {
    // Simple hash calculation for transcript data
    const transcriptString = JSON.stringify(transcript)
    return btoa(transcriptString).substring(0, 32)
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
      const { data: course, error: courseError } = await supabase
        .from('course_configuration')
        .select('topic, depth')
        .eq('id', courseId)
        .single()

      if (courseError || !course) {
        throw new Error(`Failed to fetch course information: ${courseError?.message}`)
      }

      // Get user profile for Algorand address
      const { data: userProfile } = await supabase
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
      const { data: savedCertificate, error: certificateError } = await supabase
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
      await supabase
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

  async getUserCertificates(studentId: string): Promise<CertificateData[]> {
    try {
      const { data: certificates, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch certificates: ${error.message}`)
      }

      return certificates.map(cert => ({
        certificateId: cert.certificate_id,
        studentId: cert.student_id,
        courseId: cert.course_id,
        courseName: cert.course_name,
        score: cert.score,
        maxScore: cert.max_score,
        examinationDate: cert.examination_date,
        transcriptHash: cert.transcript_hash,
        metadata: cert.metadata,
        issuerAddress: cert.issuer_address || '',
        timestamp: cert.timestamp,
        status: cert.status,
        blockchainTxId: cert.blockchain_tx_id
      }))

    } catch (error) {
      console.error('Failed to fetch user certificates:', error)
      throw error
    }
  }

  async verifyCertificate(certificateId: string): Promise<CertificateVerificationResult> {
    try {
      const verificationTimestamp = Date.now()

      const { data: certificate, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_id', certificateId)
        .single()

      if (error || !certificate) {
        return {
          isValid: false,
          error: 'Certificate not found',
          verificationTimestamp,
          blockchainConfirmed: false
        }
      }

      // Log verification attempt
      await supabase
        .from('certificate_verifications')
        .insert({
          certificate_id: certificateId,
          verification_result: {
            isValid: true,
            verificationMethod: 'database_lookup',
            timestamp: verificationTimestamp
          },
          verification_timestamp: verificationTimestamp
        })

      const certificateData: CertificateData = {
        certificateId: certificate.certificate_id,
        studentId: certificate.student_id,
        courseId: certificate.course_id,
        courseName: certificate.course_name,
        score: certificate.score,
        maxScore: certificate.max_score,
        examinationDate: certificate.examination_date,
        transcriptHash: certificate.transcript_hash,
        metadata: certificate.metadata,
        issuerAddress: certificate.issuer_address || '',
        timestamp: certificate.timestamp,
        status: certificate.status,
        blockchainTxId: certificate.blockchain_tx_id
      }

      return {
        isValid: true,
        certificateData,
        verificationTimestamp,
        blockchainConfirmed: !!certificate.blockchain_tx_id
      }

    } catch (error) {
      console.error('Certificate verification failed:', error)
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        verificationTimestamp: Date.now(),
        blockchainConfirmed: false
      }
    }
  }

  async updateUserAlgorandAddress(userId: string, algorandAddress: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          algorand_address: algorandAddress
        })

      if (error) {
        throw new Error(`Failed to update Algorand address: ${error.message}`)
      }

      console.log('Algorand address updated successfully')
    } catch (error) {
      console.error('Failed to update Algorand address:', error)
      throw error
    }
  }
}

// Export singleton instance
export const certificateAPI = new CertificateAPI()

// Helper function to get certificate API
export function getCertificateAPI(): CertificateAPI {
  return certificateAPI
}

// Helper function to generate mock examination results
export function generateMockExaminationResults(
  studentId: string,
  courseId: string,
  moduleCount: number,
  timeSpent: number = 120 // 2 hours default
): ExaminationTranscript {
  const moduleResults: ModuleResult[] = []
  let totalScore = 0
  let maxPossibleScore = 0

  for (let i = 0; i < moduleCount; i++) {
    const topicCount = Math.floor(Math.random() * 5) + 3 // 3-7 topics per module
    const topics: TopicResult[] = []
    let moduleScore = 0
    let moduleMaxScore = 0

    for (let j = 0; j < topicCount; j++) {
      const topicMaxScore = 10
      const topicScore = Math.floor(Math.random() * 3) + 7 // Score between 7-10
      
      topics.push({
        topicIndex: j,
        topicName: `Topic ${j + 1}`,
        score: topicScore,
        maxScore: topicMaxScore,
        understanding: topicScore >= 9 ? 'excellent' : 
                      topicScore >= 8 ? 'good' : 
                      topicScore >= 7 ? 'fair' : 'poor'
      })

      moduleScore += topicScore
      moduleMaxScore += topicMaxScore
    }

    moduleResults.push({
      moduleIndex: i,
      moduleName: `Module ${i + 1}`,
      score: moduleScore,
      maxScore: moduleMaxScore,
      questionsAnswered: topicCount * 2, // 2 questions per topic
      correctAnswers: Math.floor((moduleScore / moduleMaxScore) * topicCount * 2),
      timeSpent: Math.floor(timeSpent / moduleCount) + Math.floor(Math.random() * 10),
      topics
    })

    totalScore += moduleScore
    maxPossibleScore += moduleMaxScore
  }

  return {
    studentId,
    courseId,
    moduleResults,
    totalScore,
    maxPossibleScore,
    completionDate: new Date().toISOString(),
    timeSpent,
    examType: 'final'
  }
}