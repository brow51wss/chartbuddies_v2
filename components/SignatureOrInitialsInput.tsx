'use client'

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import SignaturePad from './SignaturePad'

const SIGNATURE_FONTS = [
  { label: 'Style 1', value: 'Dancing Script' },
  { label: 'Style 2', value: 'Great Vibes' },
  { label: 'Style 3', value: 'Sacramento' },
  { label: 'Style 4', value: 'Caveat' },
  { label: 'Style 5', value: 'Allura' },
]

export interface SignatureOrInitialsInputHandle {
  getText: () => string
}

interface SignatureOrInitialsInputProps {
  value: string
  onChange: (dataUrl: string) => void
  variant: 'initials' | 'signature'
  width?: number
  height?: number
  className?: string
  disabled?: boolean
  /** Saved typed text so the input can show it when loading (e.g. after save). */
  savedText?: string
  fixedFont?: string
  onFontChange?: (font: string) => void
  modeLock?: 'type' | 'draw'
  onModeChange?: (mode: 'type' | 'draw') => void
}

/**
 * Type (with font styles) or Draw. Output is always a PNG data URL for MAR.
 * One field: shows either saved image or text input (never both).
 * Use ref.getText() to read current typed text on save (avoids parent re-renders on every keystroke).
 */
const SignatureOrInitialsInput = forwardRef<SignatureOrInitialsInputHandle, SignatureOrInitialsInputProps>(function SignatureOrInitialsInput({
  value,
  onChange,
  variant,
  width = variant === 'initials' ? 180 : 320,
  height = variant === 'initials' ? 60 : 120,
  className = '',
  disabled = false,
  savedText = '',
  fixedFont,
  onFontChange,
  modeLock,
  onModeChange
}, ref) {
  const [mode, setMode] = useState<'type' | 'draw'>('type')
  const effectiveMode = modeLock ?? mode
  const setModeOrNotify = (next: 'type' | 'draw') => {
    if (modeLock) return
    setMode(next)
    onModeChange?.(next)
  }
  const [typedText, setTypedText] = useState('')
  const savedTextSyncedRef = useRef(false)
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].value)
  useImperativeHandle(ref, () => ({ getText: () => typedText }), [typedText])
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false)
  const styleDropdownRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const effectiveFont = fixedFont ?? selectedFont

  const generateDataUrlFromText = useCallback(() => {
    if (!typedText.trim()) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#111827'
    const fontSize = variant === 'initials' ? 32 : 42
    ctx.font = `${fontSize}px "${effectiveFont}"`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const x = 12
    const y = height / 2
    ctx.fillText(typedText.trim(), x, y)
    try {
      onChangeRef.current(canvas.toDataURL('image/png'))
    } catch {
      // ignore
    }
  }, [typedText, effectiveFont, width, height, variant])

  // When we have saved image + saved text from server, show the text in the input
  useEffect(() => {
    if (value?.startsWith('data:image') && savedText != null && savedText !== '' && !savedTextSyncedRef.current) {
      setTypedText(savedText)
      savedTextSyncedRef.current = true
    }
    if (!value?.startsWith('data:image') && savedText === '') savedTextSyncedRef.current = false
  }, [value, savedText])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'signature-fonts-link'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Sacramento&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if (effectiveMode !== 'type' || !typedText.trim()) return
    const run = () => {
      document.fonts.load(`24px "${effectiveFont}"`).then(() => {
        generateDataUrlFromText()
      })
    }
    run()
  }, [effectiveMode, typedText, effectiveFont, generateDataUrlFromText])

  const handleFontSelect = (font: string) => {
    setSelectedFont(font)
    onFontChange?.(font)
    setStyleDropdownOpen(false)
  }

  useEffect(() => {
    if (!styleDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [styleDropdownOpen])

  const handleClear = () => {
    setTypedText('')
    onChange('')
  }

  const handleTypedTextChange = (next: string) => {
    setTypedText(variant === 'initials' ? next.toUpperCase().slice(0, 6) : next)
  }

  const placeholder = variant === 'initials' ? 'e.g., MS' : 'Type your full signature'

  return (
    <div className={`${className}`}>
      {modeLock == null && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setModeOrNotify('type')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              effectiveMode === 'type'
                ? 'bg-lasso-teal text-white border-lasso-teal'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => setModeOrNotify('draw')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              effectiveMode === 'draw'
                ? 'bg-lasso-teal text-white border-lasso-teal'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            Draw
          </button>
        </div>
      )}

      <div className={modeLock != null ? 'mt-2' : ''}>
      {effectiveMode === 'type' ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full sm:w-auto">
              {value && value.startsWith('data:image') && !typedText ? (
                <div
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-start overflow-hidden"
                  style={{ minHeight: variant === 'initials' ? 60 : 120, width: '100%', maxWidth: width }}
                >
                  <img
                    src={value}
                    alt={variant === 'initials' ? 'Saved initials' : 'Saved signature'}
                    className="object-contain object-left max-h-full"
                    style={{ maxHeight: variant === 'initials' ? 56 : 112, width: 'auto' }}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => handleTypedTextChange(e.target.value)}
                  placeholder={placeholder}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                  style={{ fontFamily: `"${effectiveFont}", cursive`, fontSize: variant === 'initials' ? 28 : 36 }}
                />
              )}
            </div>
            {fixedFont == null && (
              <div className="w-full sm:w-auto min-w-[140px]" ref={styleDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Style
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !disabled && setStyleDropdownOpen((o) => !o)}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white text-left flex items-center justify-between"
                    style={{ fontFamily: `"${selectedFont}", cursive`, fontSize: 18 }}
                  >
                    <span>{SIGNATURE_FONTS.find((f) => f.value === selectedFont)?.label ?? 'Style 1'}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1 font-sans" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }} aria-hidden>{styleDropdownOpen ? '▴' : '▾'}</span>
                  </button>
                  {styleDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg py-1">
                      {SIGNATURE_FONTS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => handleFontSelect(f.value)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-600"
                          style={{ fontFamily: `"${f.value}", cursive`, fontSize: 18 }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} width={width} height={height} className="hidden" aria-hidden />
          {value && value.startsWith('data:image') && (
            <div className="flex items-center gap-2 flex-wrap" style={{ display: 'none' }}>
              <span className="text-xs text-gray-500 dark:text-gray-400">Saved:</span>
              <img src={value} alt="Saved" style={{ maxHeight: variant === 'initials' ? 32 : 48, maxWidth: variant === 'initials' ? 80 : 160 }} className="border border-gray-200 dark:border-gray-600 rounded inline-block" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <SignaturePad
          value={value}
          onChange={onChange}
          width={width}
          height={height}
          placeholder={variant === 'initials' ? 'Draw your initials' : 'Draw your signature'}
          disabled={disabled}
        />
      )}
      </div>
    </div>
  )
})

export default SignatureOrInitialsInput
