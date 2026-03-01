'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  role: string
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (user, token) => {
        // Also set cookie for middleware
        if (typeof window !== 'undefined') {
          document.cookie = `auth-token=${token}; path=/; max-age=604800; SameSite=Strict`
        }
        set({ user, token, isAuthenticated: true, isLoading: false })
      },
      logout: () => {
        // Clear cookie
        if (typeof window !== 'undefined') {
          document.cookie = 'auth-token=; path=/; max-age=0; SameSite=Strict'
          localStorage.removeItem('auth-storage')
        }
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setLoading(false)
        }
      },
    }
  )
)
