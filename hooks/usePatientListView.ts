import { useState, useEffect, useRef } from 'react'

export type PatientListView = 'cards' | 'list'

const STORAGE_KEY = 'lasso-patients-view'

/**
 * Global hook for the card/list view preference on any patient list page.
 * Reads and writes a single localStorage key so the preference is shared
 * across dashboard, deleted patients, and any future patient list pages.
 */
export function usePatientListView(defaultView: PatientListView = 'cards') {
  const [view, setView] = useState<PatientListView>(defaultView)
  const persistReadyRef = useRef(false)

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'list' || stored === 'cards') {
      setView(stored)
    }
  }, [])

  // Persist on every change, but skip the very first render to avoid
  // overwriting a stored value with the default before hydration fires.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!persistReadyRef.current) {
      persistReadyRef.current = true
      return
    }
    window.localStorage.setItem(STORAGE_KEY, view)
  }, [view])

  return { view, setView }
}
