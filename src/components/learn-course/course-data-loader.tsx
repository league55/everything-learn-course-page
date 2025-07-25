import { useState, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { dbOperations } from '@/lib/supabase'
import type { CourseConfiguration, Syllabus, UserEnrollment } from '@/lib/supabase'

export interface CourseData {
  configuration: CourseConfiguration
  syllabus: Syllabus
  enrollment: UserEnrollment
}

interface UseCourseDataResult {
  courseData: CourseData | null
  setCourseData: React.Dispatch<React.SetStateAction<CourseData | null>>
  loading: boolean
  error: string | null
}

export function useCourseData(courseId: string | undefined): UseCourseDataResult {
  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId || !user) return

      try {
        setLoading(true)
        setError(null)
        
        // Load course configuration
        const courses = await dbOperations.getCourseConfigurations()
        const configuration = courses.find(c => c.id === courseId)
        
        if (!configuration) {
          setError('Course not found')
          return
        }

        // Load syllabus
        const syllabus = await dbOperations.getSyllabus(courseId)
        
        if (!syllabus || syllabus.status !== 'completed') {
          setError('Course syllabus is not ready')
          return
        }

        // Load user enrollment
        const enrolledCourses = await dbOperations.getUserEnrolledCourses()
        const enrollment = enrolledCourses.find(ec => ec.id === courseId)?.user_enrollment
        
        if (!enrollment) {
          setError('You are not enrolled in this course')
          return
        }

        setCourseData({
          configuration,
          syllabus,
          enrollment
        })

      } catch (err) {
        console.error('Failed to load course data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load course')
      } finally {
        setLoading(false)
      }
    }

    loadCourseData()
  }, [courseId, user])

  return { courseData, setCourseData, loading, error }
}