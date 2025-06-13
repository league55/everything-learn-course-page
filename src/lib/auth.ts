import { supabase } from './supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthResponse {
  user: User | null
  error: AuthError | null
}

export interface SignUpData {
  email: string
  password: string
  confirmPassword: string
}

export interface SignInData {
  email: string
  password: string
}

export const authOperations = {
  // Sign up with email and password
  async signUp({ email, password, confirmPassword }: SignUpData): Promise<AuthResponse> {
    if (password !== confirmPassword) {
      return {
        user: null,
        error: {
          message: 'Passwords do not match',
          status: 400
        } as AuthError
      }
    }

    if (password.length < 6) {
      return {
        user: null,
        error: {
          message: 'Password must be at least 6 characters long',
          status: 400
        } as AuthError
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`
      }
    })

    return {
      user: data.user,
      error
    }
  },

  // Sign in with email and password
  async signIn({ email, password }: SignInData): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return {
      user: data.user,
      error
    }
  },

  // Sign out
  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Reset password
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }
}