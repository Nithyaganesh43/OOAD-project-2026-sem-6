import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../services/api'
import { extractApiErrorMessage, setAuthToken } from '../services/apiClient'

const TOKEN_STORAGE_KEY = 'task_tracker_token'
const USER_STORAGE_KEY = 'task_tracker_user'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setIsInitializing(false)
        return
      }

      try {
        const { data } = await authApi.me()
        setUser(data.user)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        setToken('')
        setUser(null)
        setAuthToken('')
      } finally {
        setIsInitializing(false)
      }
    }

    bootstrap()
  }, [token])

  const login = async ({ email, password }) => {
    try {
      const { data } = await authApi.login({ email, password })
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
      setAuthToken(data.token)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: extractApiErrorMessage(error) }
    }
  }

  const logout = () => {
    setToken('')
    setUser(null)
    setAuthToken('')
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isInitializing,
      isAdmin: user?.role === 'admin',
      isUser: user?.role === 'user',
      login,
      logout,
    }),
    [token, user, isInitializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
