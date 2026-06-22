/** Formatting helpers for the transport UI. Pure and unit-tested. */

/**
 * Formats a duration in seconds as `M:SS` (or `H:MM:SS` past an hour).
 * Negative/NaN inputs clamp to `0:00`.
 */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Formats a playback-speed multiplier, e.g. `1×`, `1.5×`, `0.25×`. */
export function formatSpeed(speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0) speed = 1
  const rounded = Math.round(speed * 100) / 100
  return `${rounded.toString()}×`
}

/** Formats the current/total frame counter, e.g. `84 / 1500`. */
export function formatFrameCounter(frame: number, frameCount: number): string {
  const current = Number.isFinite(frame) ? Math.max(0, Math.round(frame)) : 0
  if (!Number.isFinite(frameCount) || frameCount <= 0) return `${current}`
  return `${current} / ${Math.round(frameCount)}`
}
