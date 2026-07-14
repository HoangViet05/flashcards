import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { User } from '../types'
import { clearQueryCache } from '../hooks/useCachedQuery'

const TOKEN_KEY = 'flashcards.auth.token'
const USER_KEY = 'flashcards.auth.user'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())
  const [user, setUserState] = useState<User | null>(() => readStoredUser())
  const [loading, setLoading] = useState(Boolean(token))

  const storeSession = useCallback((nextToken: string, nextUser: User) => {
    window.localStorage.setItem(TOKEN_KEY, nextToken)
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUserState(nextUser)
  }, [])

  const logout = useCallback(() => {
    clearQueryCache()
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
    setToken(null)
    setUserState(null)
    setLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!readStoredToken()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const nextUser = await authApi.getMe()
      window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      setUserState(nextUser)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    refreshUser()
    window.addEventListener('flashcards.auth.expired', logout)
    return () => window.removeEventListener('flashcards.auth.expired', logout)
  }, [logout, refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    storeSession(response.access_token, response.user)
  }, [storeSession])

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const response = await authApi.register({ email, password, name })
    storeSession(response.access_token, response.user)
  }, [storeSession])

  const setUser = useCallback((nextUser: User) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUserState(nextUser)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser, setUser }),
    [user, token, loading, login, register, logout, refreshUser, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
