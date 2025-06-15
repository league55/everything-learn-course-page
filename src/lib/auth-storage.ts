import type { User, Session } from '@supabase/supabase-js'

interface StoredAuthData {
  user: User
  session: Session
  timestamp: number
  expiresAt: number
}

// Dynamic domain detection for cookie storage
function getCookieDomain(): string {
  if (typeof window === 'undefined') return ''
  
  const hostname = window.location.hostname
  
  // For localhost and IP addresses, don't set domain
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return ''
  }
  
  // For everythinglearn.online and its subdomains
  if (hostname.includes('everythinglearn.online')) {
    return '.everythinglearn.online'
  }
  
  // For other domains, try to extract the main domain
  const parts = hostname.split('.')
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`
  }
  
  return ''
}

function getCookieAttributes(): string {
  const domain = getCookieDomain()
  const isSecure = window.location.protocol === 'https:'
  
  let attributes = 'path=/; samesite=lax; max-age=31536000' // 1 year
  
  if (domain) {
    attributes += `; domain=${domain}`
  }
  
  if (isSecure) {
    attributes += '; secure'
  }
  
  return attributes
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  
  const attributes = getCookieAttributes()
  document.cookie = `${name}=${encodeURIComponent(value)}; ${attributes}`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return
  
  const domain = getCookieDomain()
  let attributes = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax'
  
  if (domain) {
    attributes += `; domain=${domain}`
  }
  
  if (window.location.protocol === 'https:') {
    attributes += '; secure'
  }
  
  document.cookie = `${name}=; ${attributes}`
}

export class AuthStorage {
  private readonly STORAGE_KEY = 'orion_auth_data'
  private readonly LIBRARY_STORAGE_KEY = 'orion_library_auth'
  private readonly MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  /**
   * Store authentication data for cross-domain library access
   */
  async storeAuthForLibrary(user: User, session: Session): Promise<void> {
    try {
      if (!session) {
        console.warn('No session provided')
        return
      }

      const authData: StoredAuthData = {
        user,
        session,
        timestamp: Date.now(),
        expiresAt: new Date(session.expires_at || 0).getTime()
      }

      // Store in cookies for cross-subdomain access
      setCookie(this.LIBRARY_STORAGE_KEY, JSON.stringify(authData))
      
      // Also store individual auth components for easier access
      setCookie('orion_access_token', session.access_token)
      setCookie('orion_refresh_token', session.refresh_token)
      setCookie('orion_user_id', user.id)
      setCookie('orion_user_email', user.email || '')

      console.log('Auth data stored in cookies for library access')
    } catch (error) {
      console.error('Failed to store auth data for library:', error)
    }
  }

  /**
   * Retrieve stored authentication data
   */
  getStoredAuthData(): StoredAuthData | null {
    try {
      const stored = getCookie(this.LIBRARY_STORAGE_KEY)
      
      if (!stored) return null

      const authData: StoredAuthData = JSON.parse(stored)
      
      // Check if data is expired
      if (Date.now() > authData.expiresAt) {
        this.clearStoredAuthData()
        return null
      }

      // Check if data is too old (beyond max age)
      if (Date.now() - authData.timestamp > this.MAX_AGE) {
        this.clearStoredAuthData()
        return null
      }

      return authData
    } catch (error) {
      console.error('Failed to retrieve stored auth data:', error)
      this.clearStoredAuthData()
      return null
    }
  }

  /**
   * Clear stored authentication data
   */
  clearStoredAuthData(): void {
    // Remove all auth-related cookies
    const cookiesToRemove = [
      this.LIBRARY_STORAGE_KEY,
      this.STORAGE_KEY,
      'orion_access_token',
      'orion_refresh_token',
      'orion_user_id',
      'orion_user_email'
    ]

    cookiesToRemove.forEach(cookieName => {
      removeCookie(cookieName)
    })

    // Also clear from localStorage as fallback
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.LIBRARY_STORAGE_KEY)
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }

  /**
   * Update stored auth data when session changes
   */
  async updateStoredAuthData(user: User | null, session: Session | null): Promise<void> {
    if (!user || !session) {
      this.clearStoredAuthData()
      return
    }

    await this.storeAuthForLibrary(user, session)
  }

  /**
   * Get auth data formatted for library consumption
   */
  getLibraryAuthData(): { accessToken: string; refreshToken: string; user: User } | null {
    const authData = this.getStoredAuthData()
    
    if (!authData) return null

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: authData.user
    }
  }

  /**
   * Get individual auth components from cookies
   */
  getIndividualAuthData(): {
    accessToken: string | null
    refreshToken: string | null
    userId: string | null
    userEmail: string | null
  } {
    return {
      accessToken: getCookie('orion_access_token'),
      refreshToken: getCookie('orion_refresh_token'),
      userId: getCookie('orion_user_id'),
      userEmail: getCookie('orion_user_email')
    }
  }

  /**
   * Check if current auth is valid for library access
   */
  isAuthValidForLibrary(): boolean {
    const authData = this.getStoredAuthData()
    const individualData = this.getIndividualAuthData()
    
    return authData !== null || (
      individualData.accessToken !== null && 
      individualData.userId !== null
    )
  }

  /**
   * Generate library URL with auth parameters (fallback method)
   */
  generateLibraryUrl(basePath: string, courseId?: string): string {
    const baseUrl = 'https://library.everythinglearn.online'
    const authData = this.getLibraryAuthData()
    
    let url = `${baseUrl}${basePath}`
    if (courseId) {
      url = url.replace(':courseId', courseId)
    }

    // Since we're using cookies, we don't need to add auth parameters to the URL
    // The cookies will be automatically sent with requests to the same domain
    
    return url
  }

  /**
   * Generate library URL for local development
   */
  generateLocalLibraryUrl(basePath: string, courseId?: string): string {
    let url = basePath
    if (courseId) {
      url = url.replace(':courseId', courseId)
    }
    
    return url
  }
}

// Export singleton instance
export const authStorage = new AuthStorage()