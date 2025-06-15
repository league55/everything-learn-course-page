/**
 * Custom auth storage implementation using cookies for cross-subdomain sharing
 * Works with localhost, bolt.new, and everythinglearn.online domains
 */

interface AuthStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function getDomainConfig() {
  if (typeof window === 'undefined') return { domain: '', secure: false }
  
  const hostname = window.location.hostname
  
  // Production domain
  if (hostname.endsWith('everythinglearn.online')) {
    return { domain: '.everythinglearn.online', secure: true }
  }
  
  // Bolt.new domain
  if (hostname.endsWith('bolt.new')) {
    return { domain: '.bolt.new', secure: true }
  }
  
  // Localhost or other development domains
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return { domain: '', secure: false }
  }
  
  // Default fallback
  return { domain: '', secure: window.location.protocol === 'https:' }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
  
  if (!cookie) return null
  
  try {
    return decodeURIComponent(cookie.split('=').slice(1).join('='))
  } catch (error) {
    console.warn('Failed to decode cookie:', error)
    return null
  }
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  
  const { domain, secure } = getDomainConfig()
  
  // Encode the value to handle special characters
  const encodedValue = encodeURIComponent(value)
  
  // Build cookie string
  let cookieString = `${name}=${encodedValue}; path=/`
  
  // Add domain if not localhost
  if (domain) {
    cookieString += `; domain=${domain}`
  }
  
  // Add secure flag for HTTPS
  if (secure) {
    cookieString += '; secure'
  }
  
  // Add SameSite for cross-site compatibility
  cookieString += '; samesite=lax'
  
  // Set expiration (1 year)
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  cookieString += `; expires=${expires.toUTCString()}`
  
  document.cookie = cookieString
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return
  
  const { domain, secure } = getDomainConfig()
  
  // Build cookie string for removal
  let cookieString = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  
  // Add domain if not localhost
  if (domain) {
    cookieString += `; domain=${domain}`
  }
  
  // Add secure flag for HTTPS
  if (secure) {
    cookieString += '; secure'
  }
  
  // Add SameSite
  cookieString += '; samesite=lax'
  
  document.cookie = cookieString
}

export const cookieAuthStorage: AuthStorage = {
  getItem: (key: string) => {
    try {
      return getCookie(key)
    } catch (error) {
      console.warn('Failed to get auth cookie:', error)
      return null
    }
  },
  
  setItem: (key: string, value: string) => {
    try {
      setCookie(key, value)
    } catch (error) {
      console.error('Failed to set auth cookie:', error)
    }
  },
  
  removeItem: (key: string) => {
    try {
      removeCookie(key)
    } catch (error) {
      console.error('Failed to remove auth cookie:', error)
    }
  }
}

// Fallback to localStorage if cookies fail
export const fallbackAuthStorage: AuthStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.warn('Failed to set localStorage item:', error)
    }
  },
  
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to remove localStorage item:', error)
    }
  }
}

// Combined storage that tries cookies first, then falls back to localStorage
export const crossDomainAuthStorage: AuthStorage = {
  getItem: (key: string) => {
    // Try cookies first
    const cookieValue = cookieAuthStorage.getItem(key)
    if (cookieValue) return cookieValue
    
    // Fallback to localStorage
    return fallbackAuthStorage.getItem(key)
  },
  
  setItem: (key: string, value: string) => {
    // Set in both cookies and localStorage for redundancy
    cookieAuthStorage.setItem(key, value)
    fallbackAuthStorage.setItem(key, value)
  },
  
  removeItem: (key: string) => {
    // Remove from both
    cookieAuthStorage.removeItem(key)
    fallbackAuthStorage.removeItem(key)
  }
}