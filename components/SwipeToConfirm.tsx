'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { ArrowRight } from 'lucide-react'

interface SwipeToConfirmProps {
  label: string            // e.g. "Confirm Pickup" | "Confirm Delivery"
  onConfirm: () => void
  loading?: boolean
  disabled?: boolean
  /** Fraction (0–1) of track width that counts as a successful swipe. Default 0.82 */
  threshold?: number
}

/**
 * Swipe-to-confirm button — Uber/Swiggy style.
 *
 * The rider drags the thumb pill to the right edge.
 * At ≥ threshold (default 82%) the action fires automatically.
 * Touch and pointer events are both handled so it works on iOS/Android/desktop.
 */
export default function SwipeToConfirm({
  label,
  onConfirm,
  loading = false,
  disabled = false,
  threshold = 0.82,
}: SwipeToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const isDragging = useRef(false)

  const [progress, setProgress] = useState(0)   // 0–1
  const [confirmed, setConfirmed] = useState(false)
  const [bouncing, setBouncing] = useState(false)

  // Reset when `loading` goes false→true (new action) or label changes
  useEffect(() => {
    if (!loading && !confirmed) reset()
  }, [label])  // eslint-disable-line react-hooks/exhaustive-deps

  const THUMB_W = 64  // px — keep in sync with w-16 below

  function getTrackWidth() {
    return (trackRef.current?.clientWidth ?? 280) - THUMB_W
  }

  function reset(bounce = false) {
    setProgress(0)
    currentXRef.current = 0
    if (bounce) {
      setBouncing(true)
      setTimeout(() => setBouncing(false), 400)
    }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled || loading || confirmed) return
    isDragging.current = true
    startXRef.current = e.clientX - currentXRef.current
      ; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [disabled, loading, confirmed])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const raw = e.clientX - startXRef.current
    const clamped = Math.max(0, Math.min(raw, getTrackWidth()))
    currentXRef.current = clamped
    setProgress(clamped / getTrackWidth())
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    if (progress >= threshold) {
      setProgress(1)
      setConfirmed(true)
      onConfirm()
    } else {
      reset(true)
    }
  }, [progress, threshold, onConfirm])

  const translateX = progress * getTrackWidth()
  // Liquid fill: same ratio as thumb position
  const fillW = `${Math.round(progress * 100)}%`

  return (
    <div
      ref={trackRef}
      className={`relative w-full select-none overflow-hidden rounded-[20px] h-[58px] flex items-center
        bg-zinc-800/80 border border-white/8
        ${disabled || loading ? 'opacity-60 pointer-events-none' : ''}
      `}
      style={{ touchAction: 'none' }}
    >
      {/* Liquid fill */}
      <div
        className="absolute left-0 top-0 h-full rounded-[20px] transition-none"
        style={{
          width: fillW,
          background: confirmed
            ? '#d4ff00'
            : `linear-gradient(90deg, rgba(212,255,0,0.18) 0%, rgba(212,255,0,0.35) 100%)`,
          transition: confirmed ? 'width 0.15s ease' : 'none',
        }}
      />

      {/* Track label */}
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-bold tracking-wide pointer-events-none"
        style={{
          color: `rgba(255,255,255,${0.25 + progress * 0.6})`,
          transition: 'color 0.1s',
        }}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating…
          </span>
        ) : confirmed ? (
          <span className="flex items-center gap-2 text-radium-green">
            <CheckCircle className="w-4 h-4" />
            Done!
          </span>
        ) : (
          label
        )}
      </span>

      {/* Draggable thumb */}
      {!confirmed && !loading && (
        <div
          ref={thumbRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute left-0 top-[5px] bottom-[5px] w-16 rounded-[16px]
            bg-radium-green flex items-center justify-center
            shadow-[0_4px_20px_rgba(212,255,0,0.35)]
            cursor-grab active:cursor-grabbing z-10
            ${bouncing ? 'animate-[bounce_0.35s_ease]' : ''}
          `}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: bouncing ? 'transform 0.35s cubic-bezier(0.22,1,0.36,1)' : 'none',
          }}
        >
          <ArrowRight className="w-5 h-5 text-zinc-950 font-black" strokeWidth={2.5} />
        </div>
      )}

      {/* Confirmed checkmark thumb */}
      {confirmed && !loading && (
        <div className="absolute left-0 top-[5px] bottom-[5px] w-full rounded-[16px] flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-zinc-950" />
        </div>
      )}
    </div>
  )
}
