import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, session } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Loading...</h3>
            <p className="text-sm text-muted-foreground">Checking authentication</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if user is authenticated
  if (!user || !session) {
    // Store the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if session is expired
  if (session.expires_at) {
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at <= now) {
      console.log('Session expired, redirecting to login')
      return <Navigate to="/login" state={{ from: location }} replace />
    }
  }

  return <>{children}</>
}