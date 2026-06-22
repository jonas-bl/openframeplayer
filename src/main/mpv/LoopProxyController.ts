import { spawn, type ChildProcess } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { MpvController } from './MpvController'
import {
  buildProxyEncodeArgs,
  planProxySeek,
  planReverseWindow,
  remapSeekSecondsToProxy,
  REVERSE_WINDOW_SECONDS,
  type ProxySession
} from './loopProxy'

/** UI-visible smooth-loop status, mirrored into the player store. */
export type SmoothLoopStatus = 'off' | 'preparing' | 'active'

/** Snapshot of the original media needed to build and later restore a proxy. */
export interface OriginalContext {
  path: string
  durationSeconds: number
  frameCount: number
  fps: number
}

/**
 * A built, cached all-intra proxy — independent of whether it's engaged.
 *   - `loop`    — an A-B loop region; seeks route through it and it loops `inf`.
 *   - `reverse` — a sliding window preloaded for smooth backward playback; it
 *     does not loop and does not capture seeks.
 */
interface ArmedProxy {
  kind: 'loop' | 'reverse'
  proxyPath: string
  original: OriginalContext
  startSeconds: number
  endSeconds: number
  startFrame: number
}

export interface LoopProxyDeps {
  /** Live mpv controller, or null when the engine is down. */
  controller: () => MpvController | null
  /** Bundled mpv binary, used headless in encode mode; null disables proxying. */
  mpvBinaryPath: string | null
  /** Directory for temporary proxy files. */
  tempDir: () => string
  /** Notified whenever the smooth-loop status changes (drives the UI badge). */
  onStatus: (status: SmoothLoopStatus) => void
  /**
   * Notified with the engaged reverse window (original-file seconds), or null
   * when no reverse window is preloaded — drives the scrubber's "ready to
   * reverse" overlay.
   */
  onReverseWindow?: (window: { start: number; end: number } | null) => void
}

/**
 * Builds and manages the smooth-loop proxy (see {@link loopProxy} for the why).
 *
 * On a complete A-B loop it transcodes that segment to an all-intra clip in the
 * background and caches it (the loop is then **armed**). While the playhead is
 * inside [A,B] mpv plays the proxy looped — wrapping is instant and reverse
 * frame-stepping is cheap (**engaged**). Seeking outside [A,B] reloads the
 * original at that point (**disengaged**), so the timeline behaves like the
 * whole clip rather than snapping back into the loop region; seeking back in
 * re-engages the cached proxy with no re-encode.
 *
 * All proxy↔original time remapping is delegated to the pure helpers; this
 * class only does the IO-heavy orchestration (spawn, swap, temp-file cleanup),
 * which is why it isn't unit-tested.
 */
export class LoopProxyController {
  private status: SmoothLoopStatus = 'off'
  /** The cached proxy for the current A-B loop, or null when no loop is armed. */
  private armed: ArmedProxy | null = null
  /** True while mpv is currently playing the proxy (playhead inside [A,B]). */
  private engaged = false

  private job: ChildProcess | null = null
  private jobOutputPath: string | null = null
  /** Bumped on every arm/disarm so a finishing encode can detect supersession. */
  private token = 0

  constructor(private readonly deps: LoopProxyDeps) {}

  /**
   * The session driving the property remap — non-null **only while engaged**, so
   * the UI sees original-file time while the proxy plays, and the original's own
   * (already full) duration once we've disengaged back to it.
   */
  get session(): ProxySession | null {
    return this.engaged && this.armed ? this.toSession(this.armed) : null
  }

  /** Any proxy (loop or reverse window) is built and cached (engaged or not). */
  get isArmed(): boolean {
    return this.armed !== null
  }

  /** An A-B *loop* proxy is armed — the only kind that captures seeks (planSeek). */
  get isLoopArmed(): boolean {
    return this.armed?.kind === 'loop'
  }

  /** mpv is currently playing the proxy. */
  get isEngaged(): boolean {
    return this.engaged && this.armed !== null
  }

  /**
   * Original-file in-point of the engaged reverse window (where the head reaches
   * the window start), or null when no reverse window is engaged. Lets the
   * caller decide whether to preload the previous window or stop at the floor.
   */
  get reverseWindowStartSeconds(): number | null {
    return this.engaged && this.armed?.kind === 'reverse' ? this.armed.startSeconds : null
  }

  get currentStatus(): SmoothLoopStatus {
    return this.status
  }

  /** Loop length in seconds for the armed proxy (0 when none). */
  get loopLengthSeconds(): number {
    return this.armed ? this.armed.endSeconds - this.armed.startSeconds : 0
  }

  /**
   * Decides where an absolute seek (original-file seconds) should land while a
   * proxy is armed, performing the engage/disengage file swap as needed, and
   * returns the seconds the caller should actually seek mpv to. `allowSwap` is
   * false during a live drag so we don't thrash `loadfile`; the swap commits on
   * the precise seek at drag release.
   */
  async planSeek(originalSeconds: number, allowSwap: boolean): Promise<number> {
    if (!this.armed) return originalSeconds
    const plan = planProxySeek(originalSeconds, this.armed.startSeconds, this.armed.endSeconds)

    if (plan.target === 'proxy') {
      if (!this.engaged) {
        if (!allowSwap) return originalSeconds // mid-drag on the original: don't swap yet
        try {
          await this.engage(plan.seconds) // load already seeked to the target — no flash
        } catch {
          return originalSeconds // couldn't swap; seek the original instead
        }
      }
      return plan.seconds // proxy-relative
    }

    // Target is outside the loop region.
    if (this.engaged) {
      if (!allowSwap) {
        // Mid-drag on the proxy: stay on it (clamp) so we don't reload per tick.
        return remapSeekSecondsToProxy(originalSeconds, this.armed.startSeconds, this.armed.endSeconds)
      }
      await this.disengage(plan.seconds)
    }
    return plan.seconds // original seconds
  }

  /**
   * Builds (or rebuilds) the proxy for [start, end] of `original`, caches it,
   * and engages it (the playhead is at the loop when A/B is just marked).
   * Supersedes any in-flight build. No-ops without an mpv binary; falls back
   * silently to the native ab-loop if the encode fails.
   */
  async arm(start: number, end: number, original: OriginalContext): Promise<void> {
    if (!this.deps.mpvBinaryPath) return
    const token = this.beginTransition()
    const previous = this.armed
    this.armed = null
    this.engaged = false
    this.setStatus('preparing')

    const outputPath = join(this.deps.tempDir(), `frameplayer-loop-${Date.now()}.mkv`)
    try {
      await this.encode(original.path, outputPath, start, end, token)
    } catch {
      if (token === this.token) this.setStatus('off')
      this.safeUnlink(outputPath)
      if (previous) this.safeUnlink(previous.proxyPath)
      return
    }
    if (token !== this.token) {
      this.safeUnlink(outputPath)
      if (previous) this.safeUnlink(previous.proxyPath)
      return
    }

    this.armed = {
      kind: 'loop',
      proxyPath: outputPath,
      original,
      startSeconds: start,
      endSeconds: end,
      startFrame: Math.round(start * (original.fps || 0))
    }
    try {
      await this.engage()
    } catch {
      // Couldn't swap; stay armed-but-disengaged on the original file.
      this.engaged = false
    }
    if (token !== this.token) return // superseded mid-swap; the newer transition owns state
    if (previous && previous.proxyPath !== this.armed.proxyPath) {
      this.safeUnlink(previous.proxyPath)
    }
    // A loop proxy is not a reverse window; clear any stale "ready to reverse" mark.
    this.setReverseWindow(null)
    this.setStatus('active')
  }

  /**
   * Preloads an all-intra window ending at `endOriginalSeconds` and engages it
   * positioned at its end, so the reverse driver can step it cheaply (every
   * frame is a keyframe). Used for smooth whole-file reverse where no A-B loop
   * proxy is engaged. Returns the window length in seconds (0 on failure / no
   * mpv binary, so the caller can fall back to stepping the original directly).
   * Reusable for sliding: pass the previous window's start as the new end, or
   * the file duration to wrap a whole-file loop.
   */
  async armReverseWindow(endOriginalSeconds: number, original: OriginalContext): Promise<number> {
    if (!this.deps.mpvBinaryPath) return 0
    const token = this.beginTransition()
    const previous = this.armed
    this.armed = null
    this.engaged = false
    this.setStatus('preparing')

    const win = planReverseWindow(endOriginalSeconds, REVERSE_WINDOW_SECONDS, 0)
    const length = win.endSeconds - win.startSeconds
    if (length <= 0) {
      if (token === this.token) this.setStatus('off')
      if (previous) this.safeUnlink(previous.proxyPath)
      return 0
    }

    const outputPath = join(this.deps.tempDir(), `frameplayer-rev-${Date.now()}.mkv`)
    try {
      await this.encode(original.path, outputPath, win.startSeconds, win.endSeconds, token)
    } catch {
      if (token === this.token) this.setStatus('off')
      this.safeUnlink(outputPath)
      if (previous) this.safeUnlink(previous.proxyPath)
      return 0
    }
    if (token !== this.token) {
      this.safeUnlink(outputPath)
      if (previous) this.safeUnlink(previous.proxyPath)
      return 0
    }

    this.armed = {
      kind: 'reverse',
      proxyPath: outputPath,
      original,
      startSeconds: win.startSeconds,
      endSeconds: win.endSeconds,
      startFrame: Math.round(win.startSeconds * (original.fps || 0))
    }
    try {
      // Engage at the window end (most recent frame); reverse steps down from there.
      await this.engage(length, 'no')
    } catch {
      this.engaged = false
    }
    if (token !== this.token) return 0
    if (previous && previous.proxyPath !== this.armed.proxyPath) {
      this.safeUnlink(previous.proxyPath)
    }
    this.setReverseWindow(
      this.engaged ? { start: win.startSeconds, end: win.endSeconds } : null
    )
    this.setStatus('active')
    return this.engaged ? length : 0
  }

  /**
   * Tears the proxy down completely: cancels an in-flight build and, if engaged,
   * reloads the original at the matching position, then deletes the cached
   * proxy. Best-effort and hang-guarded so the clear (✕) button never wedges.
   */
  async disarm(): Promise<void> {
    this.beginTransition()
    const armed = this.armed
    const wasEngaged = this.engaged
    this.armed = null
    this.engaged = false
    if (armed) {
      if (wasEngaged) {
        const c = this.deps.controller()
        const proxyPos = c ? await this.readNumber(c, 'time-pos', 0) : 0
        await this.reloadOriginal(armed.original.path, armed.startSeconds + Math.max(0, proxyPos))
      }
      this.safeUnlink(armed.proxyPath)
    }
    this.setReverseWindow(null)
    this.setStatus('off')
  }

  /** Cancels any build, removes temp files; no reload (engine is going away). */
  dispose(): void {
    this.beginTransition()
    if (this.armed) this.safeUnlink(this.armed.proxyPath)
    this.armed = null
    this.engaged = false
    // Notify (not just assign) so a 'preparing' badge can't stick if we tear
    // down mid-build. setStatus no-ops when already 'off'.
    this.setReverseWindow(null)
    this.setStatus('off')
  }

  // --- internals ---

  private toSession(a: ArmedProxy): ProxySession {
    return {
      proxyPath: a.proxyPath,
      originalPath: a.original.path,
      startSeconds: a.startSeconds,
      endSeconds: a.endSeconds,
      startFrame: a.startFrame,
      originalDurationSeconds: a.original.durationSeconds,
      originalFrameCount: a.original.frameCount
    }
  }

  /**
   * Swaps mpv to the cached proxy, optionally landing on `targetProxySeconds`
   * (else the position matching the current playhead). `engaged` is flipped on
   * **before** the swap so the property remap is live for every event the proxy
   * emits while loading — otherwise its short `duration` leaks to the UI and the
   * scrubber shrinks. Only a failed `loadfile` (or a dead engine) rolls it back.
   */
  private async engage(
    targetProxySeconds?: number,
    loopFile: 'inf' | 'no' = 'inf'
  ): Promise<void> {
    if (!this.armed || this.engaged) return
    this.engaged = true
    try {
      await this.swapToProxy(this.toSession(this.armed), targetProxySeconds, loopFile)
    } catch (err) {
      this.engaged = false
      throw err
    }
  }

  /** Reloads the original at `targetOriginalSeconds`, leaving the proxy cached. */
  private async disengage(targetOriginalSeconds: number): Promise<void> {
    if (!this.armed || !this.engaged) return
    await this.reloadOriginal(this.armed.original.path, targetOriginalSeconds)
    this.engaged = false
  }

  /** Invalidates any in-flight job and returns the new token. */
  private beginTransition(): number {
    this.token++
    if (this.job) {
      this.job.kill()
      this.job = null
    }
    if (this.jobOutputPath) {
      this.safeUnlink(this.jobOutputPath)
      this.jobOutputPath = null
    }
    return this.token
  }

  private encode(
    input: string,
    output: string,
    start: number,
    end: number,
    token: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = buildProxyEncodeArgs({
        inputPath: input,
        outputPath: output,
        startSeconds: start,
        endSeconds: end
      })
      const child = spawn(this.deps.mpvBinaryPath as string, args, {
        windowsHide: true,
        stdio: 'ignore'
      })
      this.job = child
      this.jobOutputPath = output

      child.on('error', (err) => {
        if (this.job === child) {
          this.job = null
          this.jobOutputPath = null
        }
        reject(err)
      })
      child.on('exit', (code) => {
        if (this.job === child) {
          this.job = null
          this.jobOutputPath = null
        }
        if (token !== this.token) return resolve() // superseded; caller cleans up
        if (code === 0) resolve()
        else reject(new Error(`proxy encode exited with code ${code}`))
      })
    })
  }

  /**
   * Loads the proxy looped, landing on `targetProxySeconds` (else the position
   * matching the current playhead). The seek rides the `loadfile` as a per-file
   * `start=` option (mpv ≥0.38) so mpv decodes straight to that point instead of
   * presenting the proxy's frame 0 first — no flash. The only awaited call that
   * may throw is the `loadfile`; the loop/pause settings afterwards are
   * best-effort so a transient failure can't tear the engagement (and the remap)
   * back down once the proxy is actually loaded.
   */
  private async swapToProxy(
    session: ProxySession,
    targetProxySeconds?: number,
    loopFile: 'inf' | 'no' = 'inf'
  ): Promise<void> {
    const c = this.deps.controller()
    if (!c) throw new Error('engine gone')
    const wasPaused = await this.readBool(c, 'pause', false)
    const proxyPos =
      targetProxySeconds ??
      remapSeekSecondsToProxy(
        await this.readNumber(c, 'time-pos', session.startSeconds),
        session.startSeconds,
        session.endSeconds
      )
    const loaded = c.waitForFileLoaded()
    await c.command(['loadfile', session.proxyPath, 'replace', 0, `start=${Math.max(0, proxyPos)}`])
    // Wait until the proxy is actually loaded before returning: callers (notably
    // the reverse driver) read `time-pos` right after the swap, and that property
    // is "unavailable" until the file is decodable — reading it too early kills
    // reverse stepping. Registered before `loadfile` so the event can't be missed.
    await loaded
    try {
      // A-B loop proxies loop `inf`; a reverse window does not (the driver owns it).
      await c.setProperty('loop-file', loopFile)
      // The native A-B markers were set in original-file seconds; clear them so
      // they don't fire against the proxy's timeline.
      await c.setProperty('ab-loop-a', 'no')
      await c.setProperty('ab-loop-b', 'no')
      await c.setProperty('pause', wasPaused)
    } catch {
      // best-effort: the proxy is loaded + engaged regardless
    }
  }

  /**
   * Reloads the original file at `seconds`, clearing every loop property so it
   * plays through freely. The seek rides the `loadfile` (`start=`) so the
   * original's frame 0 never flashes. Best-effort: swallows errors so callers
   * (disengage, disarm) never leave the controls wedged.
   */
  private async reloadOriginal(path: string, seconds: number): Promise<void> {
    const c = this.deps.controller()
    if (!c || !path) return
    try {
      const wasPaused = await this.readBool(c, 'pause', false)
      const loaded = c.waitForFileLoaded()
      await c.command(['loadfile', path, 'replace', 0, `start=${Math.max(0, seconds)}`])
      await loaded
      await c.setProperty('loop-file', 'no')
      await c.setProperty('ab-loop-a', 'no')
      await c.setProperty('ab-loop-b', 'no')
      await c.setProperty('pause', wasPaused)
    } catch {
      // best-effort restore
    }
  }

  private async readBool(c: MpvController, name: string, fallback: boolean): Promise<boolean> {
    try {
      const v = await c.getProperty<boolean>(name)
      return typeof v === 'boolean' ? v : fallback
    } catch {
      return fallback
    }
  }

  private async readNumber(c: MpvController, name: string, fallback: number): Promise<number> {
    try {
      const v = await c.getProperty<number>(name)
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback
    } catch {
      return fallback
    }
  }

  private setStatus(status: SmoothLoopStatus): void {
    if (this.status === status) return
    this.status = status
    this.deps.onStatus(status)
  }

  /** Last reported reverse window, so we only notify on real changes. */
  private reverseWindow: { start: number; end: number } | null = null

  private setReverseWindow(window: { start: number; end: number } | null): void {
    const same =
      (window === null && this.reverseWindow === null) ||
      (window !== null &&
        this.reverseWindow !== null &&
        window.start === this.reverseWindow.start &&
        window.end === this.reverseWindow.end)
    if (same) return
    this.reverseWindow = window
    this.deps.onReverseWindow?.(window)
  }

  private safeUnlink(path: string): void {
    try {
      rmSync(path, { force: true })
    } catch {
      // ignore
    }
  }
}
