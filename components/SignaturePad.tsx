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
  const prevPos = useRef<{ x: number; y: number } | null>(null)
  const pointsQueue = useRef<{ x: number; y: number }[]>([])
  const rafId = useRef<number | null>(null)
  const hasMoved = useRef(false)

  // Logical (CSS) coords for canvas. Use rect so we can support getCoalescedEvents().
  const getPointFromClient = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const drawSegment = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!lastPos.current) {
      lastPos.current = point
      return
    }
    const prev = lastPos.current
    ctx.beginPath()
    if (prevPos.current) {
      const p0 = prevPos.current
      ctx.moveTo(p0.x, p0.y)
      ctx.quadraticCurveTo(prev.x, prev.y, point.x, point.y)
    } else {
      ctx.moveTo(prev.x, prev.y)
      const cpx = (prev.x + point.x) / 2
      const cpy = (prev.y + point.y) / 2
      ctx.quadraticCurveTo(cpx, cpy, point.x, point.y)
    }
    ctx.stroke()
    prevPos.current = prev
    lastPos.current = point
  }, [])

  const draw = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas || !isDrawing.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!lastPos.current) {
      lastPos.current = point
      return
    }
    const prev = lastPos.current
    const dist = Math.hypot(point.x - prev.x, point.y - prev.y)
    const maxStep = 1
    if (dist > maxStep) {
      const steps = Math.ceil(dist / maxStep)
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        drawSegment({
          x: prev.x + (point.x - prev.x) * t,
          y: prev.y + (point.y - prev.y) * t
        })
      }
      return
    }
    drawSegment(point)
  }, [drawSegment])

  // Pointer events + getCoalescedEvents(): use all intermediate positions the browser coalesced,
  // so fast strokes get many points per frame and stay smooth (no lag).
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const canvas = canvasRef.current
    const point = getPointFromClient(e.clientX, e.clientY)
    if (point && canvas) {
      (e.target as Element).setPointerCapture(e.pointerId)
      isDrawing.current = true
      hasMoved.current = false
      prevPos.current = null
      lastPos.current = point
      pointsQueue.current = []
      const loop = () => {
        if (!isDrawing.current) {
          rafId.current = null
          return
        }
        const queue = pointsQueue.current
        if (queue.length > 0) {
          pointsQueue.current = []
          for (const pt of queue) draw(pt)
        }
        rafId.current = requestAnimationFrame(loop)
      }
      rafId.current = requestAnimationFrame(loop)
    }
  }, [disabled, getPointFromClient, draw])

  const endDrawing = useCallback(() => {
    if (!isDrawing.current) return
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    const canvas = canvasRef.current
    const pos = lastPos.current
    const queue = pointsQueue.current
    if (queue.length > 0 && canvas) {
      for (const pt of queue) draw(pt)
      pointsQueue.current = []
    }
    isDrawing.current = false
    lastPos.current = null
    prevPos.current = null
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
  }, [onChange, width, draw])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current || disabled) return
    e.preventDefault()
    hasMoved.current = true
    const coalesced = typeof (e.nativeEvent as PointerEvent).getCoalescedEvents === 'function'
      ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
      : []
    const toQueue: { x: number; y: number }[] = []
    if (coalesced.length > 0) {
      for (const ev of coalesced) {
        const point = getPointFromClient(ev.clientX, ev.clientY)
        if (point) toQueue.push(point)
      }
    } else {
      const point = getPointFromClient(e.clientX, e.clientY)
      if (point) toQueue.push(point)
    }
    if (toQueue.length > 0) pointsQueue.current = pointsQueue.current.concat(toQueue)
  }, [disabled, getPointFromClient])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    endDrawing()
  }, [endDrawing])

  const onPointerCancel = useCallback(() => {
    endDrawing()
  }, [endDrawing])

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerUp}
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
