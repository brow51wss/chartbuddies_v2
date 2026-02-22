import React, { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface ReadOnlyContextValue {
  isReadOnly: boolean
  enterReadOnly: () => void
  exitReadOnly: (password: string) => Promise<boolean>
}

const ReadOnlyContext = createContext<ReadOnlyContextValue | null>(null)

const STORAGE_KEY = 'lasso_readonly_mode'

export function ReadOnlyProvider({ children }: { children: React.ReactNode }) {
  const [isReadOnly, setIsReadOnlyState] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const setReadOnly = useCallback((value: boolean) => {
    setIsReadOnlyState(value)
    try {
      if (value) {
        localStorage.setItem(STORAGE_KEY, '1')
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  }, [])

  const enterReadOnly = useCallback(() => {
    setReadOnly(true)
  }, [setReadOnly])

  const exitReadOnly = useCallback(
    async (password: string): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return false
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
      if (error) return false
      setReadOnly(false)
      return true
    },
    [setReadOnly]
  )

  const value: ReadOnlyContextValue = {
    isReadOnly,
    enterReadOnly,
    exitReadOnly
  }

  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
}

export function useReadOnly(): ReadOnlyContextValue {
  const ctx = useContext(ReadOnlyContext)
  if (!ctx) {
    return {
      isReadOnly: false,
      enterReadOnly: () => {},
      exitReadOnly: async () => false
    }
  }
  return ctx
}
