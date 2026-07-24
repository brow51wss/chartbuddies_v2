import React from 'react'

type Props = {
  children?: React.ReactNode
  className?: string
}

/**
 * ModuleHeader — white card that sits between the page h1 and the module's
 * main content. Provides the white card shell; callers own their internal layout.
 *
 * Used on: MAR, Progress Notes (and any future module that follows this pattern).
 */
export function ModuleHeader({ children, className = '' }: Props) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 ${className}`.trim()}>
      {children}
    </div>
  )
}
