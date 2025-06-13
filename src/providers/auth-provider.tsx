import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession()
      if (error) {
        console.warn('Failed to refresh session:', error)
        return
      }
      
      if (refreshedSession) {
        setSession(refreshedSession)
        setUser(refreshedSession.user)
      }
    } catch (error) {
      console.warn('Error refreshing session:', error)
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // First, try to get the current session (this will pick up stored tokens)
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.warn('Error getting initial session:', sessionError)
        }

        if (mounted) {
          if (initialSession) {
            // Check if the session is still valid
            const now = Math.floor(Date.now() / 1000)
            const expiresAt = initialSession.expires_at || 0
            
            if (expiresAt > now) {
              // Session is still valid
              setSession(initialSession)
              setUser(initialSession.user)
            } else {
              // Session expired, try to refresh
              console.log('Session expired, attempting to refresh...')
              await refreshSession()
            }
          } else {
            // No session found
            setSession(null)
            setUser(null)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (event === 'SIGNED_OUT') {
            setUser(null)
            setSession(null)
          }
          
          // Only set loading to false after the initial session check
          if (event !== 'INITIAL_SESSION') {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
      }
    } catch (error) {
      console.error('Error during sign out:', error)
    } finally {
      setUser(null)
      setSession(null)
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshSession
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}