'use client'

import React, { useRef, useEffect, useCallback } from 'react'

interface SignaturePadProps {
  value: string // data URL (image) or empty
  onChange: (dataUrl: string) => void
  width?: number
  height?: number
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * DocuSign-style drawing pad for initials or signature.
 * Outputs PNG data URL for storage; MAR can render as <img> when value is data URL.
 */
export default function SignaturePad({
  value,
  onChange,
  width = 300,
  height = 120,
  placeholder = 'Draw here',
  className = '',
  disabled = false
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const hasMoved = useRef(false)

  // Use logical (CSS) coordinates so they match the scaled context (ctx.scale(dpr, dpr)).
  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0] || (e as React.TouchEvent).changedTouches?.[0]
      if (!t) return null
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    const m = e as MouseEvent
    return { x: m.clientX - rect.left, y: m.clientY - rect.top }
  }, [])

  const draw = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas || !isDrawing.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (lastPos.current) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
    lastPos.current = point
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    e.preventDefault()
    const point = getPoint(e)
    if (point) {
      isDrawing.current = true
      hasMoved.current = false
      lastPos.current = point
    }
  }, [disabled, getPoint])

  const moveDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || disabled) return
    e.preventDefault()
    hasMoved.current = true
    const point = getPoint(e)
    if (point) {
      draw(point)
    }
  }, [disabled, draw])

  const endDrawing = useCallback(() => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    const pos = lastPos.current
    isDrawing.current = false
    lastPos.current = null
    // If user tapped without moving, draw a small dot (e.g. for "i", "j", periods)
    if (canvas && pos && !hasMoved.current) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const refWidth = 320
        const dotRadius = Math.max(1.5, 2 * (width / refWidth))
        ctx.fillStyle = '#212427'
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, dotRadius, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png')
        onChange(dataUrl)
      } catch {
        // ignore
      }
    }
  }, [onChange, width])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#212427'
      onChange('')
    }
  }, [onChange, width, height])

  // Initialize canvas size and stroke style (once)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#212427'
      // Scale line width with canvas so stroke looks same thickness in portrait vs landscape
      const refWidth = 320
      ctx.lineWidth = Math.max(1.5, 2 * (width / refWidth))
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [width, height])

  // Load existing image into canvas when value is a data URL (use logical size; context is scaled by dpr)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value || !value.startsWith('data:image')) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#212427'
      ctx.drawImage(img, 0, 0, width, height)
    }
    img.src = value
  }, [value, width, height])

  return (
    <div className={`inline-block ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={moveDrawing}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={moveDrawing}
        onTouchEnd={endDrawing}
        className="border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 touch-none cursor-crosshair disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ width: `${width}px`, height: `${height}px`, backgroundColor: '#FAFAFA' }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline disabled:opacity-50"
        >
          Clear
        </button>
        {!value && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{placeholder}</span>
        )}
      </div>
    </div>
  )
}
