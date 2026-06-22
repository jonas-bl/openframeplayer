import type { LoopMode } from '@shared/player-state'
import type { MpvScalar } from './protocol'
import { MpvProperty } from './mpvProperties'

/** The slice of {@link MpvController} the reverse driver needs (structural). */
export interface ReverseControls {
  getProperty<T = unknown>(name: string): Promise<T>
  command(args: MpvScalar[]): Promise<unknown>
  setProperty(name: string, value: MpvScalar): Promise<void>
}

/** Where backward stepping stops or wraps, derived from the active loop mode. */
export interface ReverseBounds {
  /** Lowest time (seconds) reverse may reach before it wraps or stops. */
  floor: number
  /** Time (seconds) to jump to on hitting the floor, or null to stop there. */
  wrapTo: number | null
}

const DEFAULT_FPS = 30
/** Never step faster than this regardless of fps, to keep IPC load sane. */
const MIN_INTERVAL_MS = 16
const EPSILON = 1e-3

/**
 * Plays a clip backward by repeatedly seeking back one frame-time, simulating
 * continuous reverse playback from the main process.
 *
 * Native mpv backward playback (`play-direction=backward`) deadlocks the
 * decoder on this setup: the `set_property` call never returns and so
 * head-of-line-blocks the entire IPC command queue — the player freezes hard.
 * This driver sidesteps that: it holds mpv paused and walks the play head back
 * at the clip's frame rate.
 *
 * It steps with absolute `seek ... exact`, NOT `frame-back-step`. `frame-back-step`
 * only works when decoded frames are still buffered *behind* the play head, so
 * it silently does nothing right after a fresh `loadfile` (e.g. the moment a
 * smooth-loop proxy is swapped in) — which is exactly why reverse failed once an
 * A-B loop was set. A backward exact seek re-decodes from a keyframe instead, so
 * it works regardless of buffer state, and on the all-intra proxy (every frame a
 * keyframe) it's cheap and smooth.
 */
export class ReverseDriver {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private bounds: ReverseBounds = { floor: 0, wrapTo: null }
  private intervalMs = 1000 / DEFAULT_FPS
  /** Seconds to step back each tick (one frame at the clip's fps). */
  private stepSeconds = 1 / DEFAULT_FPS
  /**
   * Authoritative play-head position (seconds) the driver walks back itself,
   * rather than re-reading `time-pos` every tick. `null` means "unknown — seed
   * it from mpv on the next tick" (used after an extend swaps in a new window).
   *
   * This is the crux of reverse working at all: right after a proxy swap mpv's
   * `time-pos` briefly reports ~0 (before the `start=` seek settles). Trusting
   * that per tick made the driver mistake the just-loaded frame for "the start",
   * so it wrapped forward (A-B → oscillates) or stopped (whole file → frozen).
   * Owning the counter and only seeding from a *settled* position fixes both.
   */
  private position: number | null = null

  /**
   * @param controls - returns the live mpv controller, or null when the engine
   *   is gone (the driver then stops itself on the next tick).
   * @param onFinished - called when reverse stops on its own (reached the floor
   *   with no wrap target *and* no extension), so the UI's reverse toggle can be
   *   cleared.
   * @param onExtend - when the head reaches the floor and there is no in-bounds
   *   wrap target, this is asked for the next bounds (e.g. after preloading the
   *   previous all-intra reverse window, which also repositions the play head at
   *   the new window's end). Returning null finishes; omitting it finishes too.
   */
  constructor(
    private readonly controls: () => ReverseControls | null,
    private readonly onFinished: () => void,
    private readonly onExtend?: () => Promise<ReverseBounds | null>
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Begins stepping backward within `bounds`. Restarts cleanly if running.
   *
   * Pass `seedSeconds` when the caller knows exactly where the head sits (e.g. a
   * reverse window is engaged at its end, or stepping the original from a known
   * point) so the driver never has to read the still-settling `time-pos` of a
   * fresh swap. Omit it to seed from mpv on the first tick (safe when no swap
   * just happened, e.g. reversing an already-engaged A-B loop proxy).
   */
  async start(bounds: ReverseBounds, seedSeconds?: number): Promise<void> {
    this.stop()
    const controls = this.controls()
    if (!controls) return
    this.bounds = bounds
    this.position =
      typeof seedSeconds === 'number' && Number.isFinite(seedSeconds) ? seedSeconds : null
    this.running = true
    try {
      // We own the timeline now: hold mpv paused so forward decode can't fight
      // the stepping, and step at the clip's frame rate for ~1x reverse.
      await controls.setProperty(MpvProperty.pause, true)
      await this.resolveRate(controls)
    } catch {
      this.running = false
      return
    }
    if (this.running) this.schedule(0)
  }

  /** Stops stepping. Safe to call when idle. Does not fire `onFinished`. */
  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => void this.tick(), delayMs)
  }

  private async tick(): Promise<void> {
    if (!this.running) return
    const controls = this.controls()
    if (!controls) {
      this.stop()
      return
    }

    const started = Date.now()

    // Seed (or re-seed after an extend) the authoritative position from mpv when
    // unknown. We only read here, never in the steady step below, so a fresh
    // swap's transient ~0 can't be mistaken for the floor. If the read isn't
    // ready yet (file still loading → IPC rejects), retry next tick.
    if (this.position === null) {
      let seeded: number | null = null
      try {
        const pos = await controls.getProperty<number>(MpvProperty.timePos)
        if (typeof pos === 'number' && Number.isFinite(pos)) seeded = pos
      } catch {
        // transient: the file is still loading
      }
      if (seeded === null) {
        if (this.running && this.controls()) this.schedule(this.intervalMs)
        return
      }
      this.position = seeded
    }

    try {
      if (this.position <= this.bounds.floor + EPSILON) {
        if (this.bounds.wrapTo !== null) {
          this.position = this.bounds.wrapTo
          await controls.command(['seek', this.position, 'absolute', 'exact'])
        } else {
          // No in-bounds wrap: ask for an extension (preloads the previous
          // reverse window and repositions the head at its end). Re-seed from
          // the freshly engaged window on the next tick.
          const next = this.onExtend ? await this.onExtend() : null
          if (!this.running) return
          if (!next) {
            this.finish()
            return
          }
          this.bounds = next
          this.position = null
        }
      } else {
        this.position = Math.max(this.bounds.floor, this.position - this.stepSeconds)
        await controls.command(['seek', this.position, 'absolute', 'exact'])
      }
    } catch {
      // IPC error (engine torn down mid-step): stop quietly.
      this.stop()
      return
    }

    if (!this.running) return
    const elapsed = Date.now() - started
    this.schedule(Math.max(0, this.intervalMs - elapsed))
  }

  /** Stops and reports that reverse ended by itself (reached the floor). */
  private finish(): void {
    this.stop()
    this.onFinished()
  }

  /** Reads the clip fps and derives the tick interval + per-step distance. */
  private async resolveRate(controls: ReverseControls): Promise<void> {
    let fps = DEFAULT_FPS
    try {
      const reported = await controls.getProperty<number>(MpvProperty.fps)
      if (typeof reported === 'number' && reported > 0) fps = reported
    } catch {
      // keep the default rate
    }
    this.stepSeconds = 1 / fps
    this.intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / fps)
  }
}

/** Derives reverse stop/wrap bounds from the current playback state. */
export function computeReverseBounds(playback: {
  loopMode: LoopMode
  loopStart: number | null
  loopEnd: number | null
  duration: number
}): ReverseBounds {
  if (playback.loopMode === 'ab') {
    return {
      floor: playback.loopStart ?? 0,
      wrapTo: playback.loopEnd ?? (playback.duration || null)
    }
  }
  if (playback.loopMode === 'file') {
    return { floor: 0, wrapTo: playback.duration || null }
  }
  // No loop: walk back to the start of the file, then stop.
  return { floor: 0, wrapTo: null }
}
