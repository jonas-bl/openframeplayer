/**
 * Pure helpers for the smooth-loop proxy feature.
 *
 * The "proxy" is a short, all-intra (every-frame-a-keyframe) re-encode of the
 * active A-B loop region. Playing that instead of the original makes looping
 * wrap instantly and makes reverse frame-stepping cheap, because no frame needs
 * a decode burst from a distant keyframe. The orchestration (transcode, file
 * swap) lives in {@link LoopProxyController}; the math that has to be correct
 * lives here, isolated and unit-tested.
 */

/** The loop config slice that decides whether a proxy is worth building. */
export interface LoopConfig {
  mode: 'off' | 'file' | 'ab'
  start: number | null
  end: number | null
}

/** A built, active proxy session: everything needed to remap proxy↔original. */
export interface ProxySession {
  /** Temp file the proxy was written to (mpv is currently playing this). */
  proxyPath: string
  /** Original media path, restored on disarm and reported to the UI. */
  originalPath: string | null
  /** Loop in-point in original-file seconds (the proxy's time 0 maps here). */
  startSeconds: number
  /** Loop out-point in original-file seconds. */
  endSeconds: number
  /** Frame index in the original file the proxy's frame 0 maps to. */
  startFrame: number
  /** Original media duration (seconds) — reported instead of the proxy's. */
  originalDurationSeconds: number
  /** Original total frame count — reported instead of the proxy's. */
  originalFrameCount: number
}

/** Inputs for {@link buildProxyEncodeArgs}. */
export interface ProxyEncodeOptions {
  inputPath: string
  outputPath: string
  startSeconds: number
  endSeconds: number
}

/**
 * True when the loop is a complete, non-empty A-B range worth proxying. A
 * half-marked loop (only A, or A>=B) is left on the native ab-loop path.
 */
export function isCompleteAbLoop(loop: LoopConfig): boolean {
  return (
    loop.mode === 'ab' &&
    loop.start !== null &&
    loop.end !== null &&
    loop.end > loop.start
  )
}

/**
 * mpv command-line args (headless encode mode) that re-encode just the [start,
 * end] segment of `inputPath` into an all-intra clip at `outputPath`.
 *
 * `--ovc=libx264` with `g=1` forces an IDR keyframe on every frame, so the
 * proxy has no inter-frame dependencies at all — every frame decodes on its
 * own, which is what makes looping and reverse cheap. `ultrafast`/`crf=16`
 * keeps the one-time encode quick and visually lossless. Audio is re-encoded so
 * a forward smooth loop keeps its sound (ignored when the source has none).
 */
export function buildProxyEncodeArgs(opts: ProxyEncodeOptions): string[] {
  return [
    opts.inputPath,
    '--no-config',
    '--no-terminal',
    '--msg-level=all=no',
    `--start=${opts.startSeconds}`,
    `--end=${opts.endSeconds}`,
    '--ovc=libx264',
    '--ovcopts=preset=ultrafast,crf=16,g=1',
    '--oac=aac',
    '--of=matroska',
    `--o=${opts.outputPath}`
  ]
}

/**
 * Remaps an observed mpv property (reported in proxy time while a proxy plays)
 * back into original-file terms, so the UI's timeline, frame counter and title
 * keep showing the whole clip. Properties not affected pass through unchanged.
 */
export function remapObservedToOriginal(
  name: string,
  value: unknown,
  session: ProxySession
): { name: string; value: unknown } {
  switch (name) {
    case 'time-pos':
      return typeof value === 'number'
        ? { name, value: value + session.startSeconds }
        : { name, value }
    case 'estimated-frame-number':
      return typeof value === 'number'
        ? { name, value: value + session.startFrame }
        : { name, value }
    case 'duration':
      return { name, value: session.originalDurationSeconds }
    case 'estimated-frame-count':
      return { name, value: session.originalFrameCount }
    case 'path':
      return { name, value: session.originalPath }
    default:
      return { name, value }
  }
}

/**
 * Converts an absolute seek in original-file seconds into a proxy-relative
 * seek, clamped into the loop region (the proxy contains only [start, end], and
 * an active A-B loop keeps the playhead inside that range anyway).
 */
export function remapSeekSecondsToProxy(
  seconds: number,
  startSeconds: number,
  endSeconds: number
): number {
  const clamped = Math.min(endSeconds, Math.max(startSeconds, seconds))
  return clamped - startSeconds
}

/**
 * Where an absolute seek (original-file seconds) should land while an A-B proxy
 * is armed:
 *   - `proxy`    — the target is inside [start, end]; engage the proxy and seek
 *     to the proxy-relative time (`seconds - start`).
 *   - `original` — the target is outside the loop; disengage and play the real
 *     file at the unchanged original seconds.
 *
 * This is the decision that makes the timeline behave like the full clip: you
 * can scrub past B and the original is reloaded there, instead of snapping back
 * into the loop region.
 */
export type ProxySeekPlan =
  | { target: 'proxy'; seconds: number }
  | { target: 'original'; seconds: number }

export function planProxySeek(
  originalSeconds: number,
  startSeconds: number,
  endSeconds: number
): ProxySeekPlan {
  if (originalSeconds >= startSeconds && originalSeconds <= endSeconds) {
    return { target: 'proxy', seconds: originalSeconds - startSeconds }
  }
  return { target: 'original', seconds: originalSeconds }
}

/**
 * Reverse-driver bounds for proxy playback: the proxy *is* the loop, so reverse
 * walks the whole clip (0..length) and wraps at the end back to the start.
 */
export function proxyReverseBounds(loopLengthSeconds: number): {
  floor: number
  wrapTo: number | null
} {
  return { floor: 0, wrapTo: loopLengthSeconds > 0 ? loopLengthSeconds : null }
}

/**
 * Default length (seconds) of the all-intra window preloaded for smooth reverse
 * of the whole file. A few seconds of reverse — the common case — fits in one
 * window with no re-encode; reversing further preloads the previous window.
 */
export const REVERSE_WINDOW_SECONDS = 20

/**
 * The [start, end] window (original-file seconds) to transcode for smooth
 * reverse ending at `endSeconds`: it spans `windowSeconds` back from there,
 * clamped to `floorSeconds` (0, or an A-B in-point). When the head later reaches
 * `start`, the previous window is built with `endSeconds = start`.
 */
export function planReverseWindow(
  endSeconds: number,
  windowSeconds: number,
  floorSeconds = 0
): { startSeconds: number; endSeconds: number } {
  const end = Math.max(floorSeconds, endSeconds)
  const start = Math.max(floorSeconds, end - windowSeconds)
  return { startSeconds: start, endSeconds: end }
}
