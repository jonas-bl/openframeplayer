import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface SeekBarProps {
  position: number
  duration: number
  /** A-B loop in-point (seconds), or null when no segment loop is active. */
  loopStart?: number | null
  /** A-B loop out-point (seconds), or null when no segment loop is active. */
  loopEnd?: number | null
  /**
   * Footage (original-file seconds) currently preloaded for smooth reverse, or
   * null when none — drawn as a distinct band so you can see what's ready to
   * reverse-play.
   */
  reverseWindow?: { start: number; end: number } | null
  /**
   * Seek to `seconds`. `precise` is false during a live drag (fast keyframe
   * seek, instant frame) and true on release (frame-accurate landing).
   */
  onSeek: (seconds: number, precise: boolean) => void
}

/**
 * Custom scrubber that seeks the video live while dragging. The seek is
 * throttled to one per animation frame so a fast drag over 4K material doesn't
 * flood mpv with exact-seek requests; a final seek lands on release. Clicking
 * the track jumps to that point.
 */
export function SeekBar({
  position,
  duration,
  loopStart = null,
  loopEnd = null,
  reverseWindow = null,
  onSeek
}: SeekBarProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragFraction, setDragFraction] = useState<number | null>(null)

  // Animation-frame throttle for live seeks during a drag.
  const seekRaf = useRef<number | null>(null)
  const pendingSeconds = useRef(0)

  const hasDuration = duration > 0
  const fraction = dragFraction ?? (hasDuration ? clamp01(position / duration) : 0)

  const loopA = hasDuration && loopStart !== null ? clamp01(loopStart / duration) : null
  const loopB = hasDuration && loopEnd !== null ? clamp01(loopEnd / duration) : null
  const hasRegion = loopA !== null && loopB !== null && loopB > loopA

  const revA = hasDuration && reverseWindow ? clamp01(reverseWindow.start / duration) : null
  const revB = hasDuration && reverseWindow ? clamp01(reverseWindow.end / duration) : null
  const hasReverse = revA !== null && revB !== null && revB > revA

  const fractionFromEvent = (event: ReactPointerEvent<HTMLDivElement>): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp01((event.clientX - rect.left) / rect.width)
  }

  const liveSeek = (seconds: number): void => {
    pendingSeconds.current = seconds
    if (seekRaf.current !== null) return
    seekRaf.current = requestAnimationFrame(() => {
      seekRaf.current = null
      onSeek(pendingSeconds.current, false)
    })
  }

  const cancelLiveSeek = (): void => {
    if (seekRaf.current !== null) {
      cancelAnimationFrame(seekRaf.current)
      seekRaf.current = null
    }
  }

  useEffect(() => cancelLiveSeek, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!hasDuration) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const f = fractionFromEvent(event)
    setDragFraction(f)
    liveSeek(f * duration)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragFraction === null) return
    const f = fractionFromEvent(event)
    setDragFraction(f)
    liveSeek(f * duration)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragFraction === null) return
    const target = fractionFromEvent(event)
    cancelLiveSeek()
    setDragFraction(null)
    onSeek(target * duration, true)
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="group relative flex h-4 cursor-pointer items-center"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(fraction * duration)}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-500">
        <div className="h-full rounded-full bg-accent" style={{ width: `${fraction * 100}%` }} />
      </div>

      {/* Preloaded reverse window: footage ready to reverse-play smoothly. */}
      {hasReverse && (
        <div
          className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-sky-400/40 ring-1 ring-inset ring-sky-300/60"
          style={{ left: `${revA! * 100}%`, width: `${(revB! - revA!) * 100}%` }}
          title="Ready to reverse-play"
        />
      )}

      {/* A-B loop region + end markers, drawn above the track. */}
      {hasRegion && (
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-amber-400/70"
          style={{ left: `${loopA! * 100}%`, width: `${(loopB! - loopA!) * 100}%` }}
        />
      )}
      {loopA !== null && <LoopTick fraction={loopA} />}
      {loopB !== null && <LoopTick fraction={loopB} />}

      <div
        className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${fraction * 100}%`, opacity: dragFraction !== null ? 1 : undefined }}
      />
    </div>
  )
}

/** A short vertical tick marking an A-B loop end-point on the track. */
function LoopTick({ fraction }: { fraction: number }): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute h-3 w-0.5 -translate-x-1/2 rounded-full bg-amber-400"
      style={{ left: `${fraction * 100}%` }}
    />
  )
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
