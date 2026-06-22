import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { PlayerAction } from '@shared/player-actions'
import type { PlayerStateStore } from '../state/PlayerStateStore'
import type { MpvEngine } from '../mpv/MpvEngine'
import { mapActionToOperations } from '../mpv/commandMap'
import { executeOperations } from '../mpv/executeOperations'
import { computeReverseBounds, ReverseDriver, type ReverseBounds } from '../mpv/ReverseDriver'
import { LoopProxyController, type OriginalContext } from '../mpv/LoopProxyController'
import { isCompleteAbLoop, proxyReverseBounds, remapObservedToOriginal } from '../mpv/loopProxy'
import { MpvProperty } from '../mpv/mpvProperties'
import { buildScreenshotPath } from '../capture/screenshotPath'

export interface PlayerServiceDeps {
  store: PlayerStateStore
  /** The mpv engine, or null when mpv could not be located. */
  engine: MpvEngine | null
  /** Returns the directory screenshots are written to (configurable, may change). */
  screenshotDir: () => string
  /** Notified with the file path after a successful screenshot. */
  onScreenshotSaved?: (filePath: string) => void
  /** Bundled mpv binary, used headless to build smooth-loop proxies; null disables them. */
  mpvBinaryPath?: string | null
  /** Directory for temporary proxy files (defaults to the OS temp dir). */
  tempDir?: () => string
}

/**
 * Application service: the single entry point for acting on the player.
 *
 * It turns a semantic {@link PlayerAction} into mpv operations (via the central
 * command map) and executes them, plus maintains the few pieces of UI state mpv
 * does not report back as properties (the horizontal-flip toggle).
 *
 * Intentionally free of Electron specifics so it can be unit-tested with a fake
 * engine; the IPC bridge is the only Electron-aware layer.
 */
export class PlayerService {
  /** Drives backward playback by stepping frames (native reverse deadlocks mpv). */
  private readonly reverse: ReverseDriver
  /** Builds/plays the all-intra proxy that makes looping + reverse smooth. */
  private readonly proxy: LoopProxyController
  /**
   * Whether the user wants playback advancing. Distinct from mpv's `pause`
   * because while playing **backward** the reverse driver holds mpv internally
   * paused and owns the timeline — so mpv's pause can't represent play/stop. The
   * actual motion is `playIntent` combined with the `loopReverse` direction.
   */
  private playIntent = false
  /**
   * Serializes {@link dispatch}: each action (and the multi-step proxy build it
   * may await) runs to completion before the next begins. Actions arrive from
   * independent IPC calls, so without this an action clicked during a ~1s proxy
   * encode would interleave with it — racing the shared proxy/reverse/playIntent
   * state into inconsistent combinations (stuck `preparing`, a half-built proxy,
   * a wedged play button). A failed action must not stall the queue, so the
   * chain recovers on both fulfilment and rejection.
   */
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly deps: PlayerServiceDeps) {
    this.reverse = new ReverseDriver(
      () => (this.deps.engine?.isReady ? this.deps.engine.controller : null),
      () => this.onReverseReachedStart(),
      () => this.extendReverse()
    )
    this.proxy = new LoopProxyController({
      controller: () => (this.deps.engine?.isReady ? this.deps.engine.controller : null),
      mpvBinaryPath: this.deps.mpvBinaryPath ?? null,
      tempDir: this.deps.tempDir ?? (() => tmpdir()),
      onStatus: (status) =>
        this.deps.store.update((s) => ({
          ...s,
          playback: { ...s.playback, smoothLoop: status }
        })),
      onReverseWindow: (window) =>
        this.deps.store.update((s) => ({
          ...s,
          playback: { ...s.playback, reverseWindow: window }
        }))
    })
  }

  async dispatch(action: PlayerAction): Promise<void> {
    this.queue = this.queue.then(
      () => this.run(action),
      () => this.run(action)
    )
    return this.queue
  }

  private async run(action: PlayerAction): Promise<void> {
    const engine = this.deps.engine
    if (!engine?.isReady) return

    if (action.type === 'screenshot') {
      const path = this.resolveScreenshotPath()
      await this.screenshotTo(path)
      this.deps.onScreenshotSaved?.(path)
      return
    }

    // Play/pause and direction are intercepted: while playing backward the
    // reverse driver owns the timeline (mpv is held paused), so a plain
    // `cycle pause` must never reach mpv. Motion = playIntent × direction.
    if (action.type === 'playPause') {
      // Toggle the authoritative intent, not mpv's `pause`: while reversing the
      // driver holds mpv paused, so deriving the next state from the store's
      // (remapped) pause is unreliable — toggling intent always does the right
      // thing whether playing forward or backward.
      this.playIntent = !this.playIntent
      await this.applyMotion()
      return
    }
    if (action.type === 'setPaused') {
      this.playIntent = !action.paused
      await this.applyMotion()
      return
    }
    // Reverse is a persistent direction toggle, not a one-shot. Store the
    // direction, then (re)apply motion: flip live if playing, else just arm it.
    if (action.type === 'setLoopReverse') {
      this.setReverseFlag(action.reverse)
      await this.applyMotion()
      return
    }

    // Loading a new file resets the proxy + reverse direction to a clean slate.
    if (action.type === 'load') {
      this.reverse.stop()
      this.setReverseFlag(false)
      this.playIntent = false
      if (this.proxy.isArmed) await this.proxy.disarm()
    }

    // Looping is special: it may build/tear down a smooth-loop proxy and swap
    // the file mpv is playing, so it can't go straight through the command map.
    if (action.type === 'setLoop') {
      await this.handleSetLoop(action)
      return
    }

    // An absolute seek needs care around the proxy and reverse driver.
    if (action.type === 'seekAbsolute') {
      const wasReversing = this.reverse.isRunning
      if (wasReversing) this.reverse.stop()
      // A reverse preload window only holds a slice, so release it first and let
      // the seek land on the real file. An A-B *loop* proxy instead translates
      // the seek via planSeek: inside [A,B] engages it (loop-relative time),
      // outside reloads the original there — so the timeline acts like the whole
      // clip. Swaps defer during a live drag (`precise === false`) to avoid
      // thrashing `loadfile`, committing on release.
      if (this.proxy.isEngaged && !this.proxy.isLoopArmed) await this.proxy.disarm()
      let seconds = action.seconds
      if (this.proxy.isLoopArmed) {
        seconds = await this.proxy.planSeek(action.seconds, action.precise !== false)
      }
      const ops = mapActionToOperations({ ...action, seconds }, { screenshotPath: '' })
      await executeOperations(engine.controller, ops)

      // Resume backward playback from the seek target (the store position lags
      // the seek, so pass the target explicitly).
      if (wasReversing && this.playIntent && this.deps.store.getState().playback.loopReverse) {
        await this.startReverse(action.seconds)
      }
      return
    }

    const operations = mapActionToOperations(action, { screenshotPath: '' })
    await executeOperations(engine.controller, operations)

    this.applyUiOnlyState(action)
  }

  /**
   * Applies a loop change. The native ab-loop is set immediately (so the loop
   * works right away with its small hitch), then a smooth-loop proxy is built
   * in the background and swapped in when ready. Turning the loop off, or
   * changing the A-B range, tears the proxy down first.
   */
  private async handleSetLoop(
    action: Extract<PlayerAction, { type: 'setLoop' }>
  ): Promise<void> {
    const engine = this.deps.engine
    if (!engine?.isReady) return

    // The reverse stepping must pause during the file swap below; we re-establish
    // motion afterwards with the new loop's bounds (it composes with looping).
    if (this.reverse.isRunning) this.reverse.stop()

    // If a proxy is armed, tear it down so the native ops below land on the real
    // file (and the timeline math resets) before we (re)build for the new range.
    if (this.proxy.isArmed) await this.proxy.disarm()

    const operations = mapActionToOperations(action, { screenshotPath: '' })
    await executeOperations(engine.controller, operations)
    this.applyUiOnlyState(action)

    // Build a smooth proxy for a complete A-B range (no-op without an mpv path).
    const { playback } = this.deps.store.getState()
    if (isCompleteAbLoop(action) && playback.filePath) {
      await this.proxy.arm(action.start as number, action.end as number, {
        path: playback.filePath,
        durationSeconds: playback.duration,
        frameCount: playback.frameCount,
        fps: playback.fps
      })
    }

    // Re-establish motion in the new scope: if the user was playing (forward or
    // backward), resume; applyMotion reads the (possibly engaged) proxy bounds.
    await this.applyMotion()
  }

  /**
   * Applies the current play intent + direction to mpv. Playing backward hands
   * the timeline to the reverse driver (which holds mpv paused and steps); any
   * other combination stops the driver and sets mpv's pause to match the intent.
   */
  private async applyMotion(): Promise<void> {
    const c = this.deps.engine?.isReady ? this.deps.engine.controller : null
    if (!c) return
    const backward = this.deps.store.getState().playback.loopReverse

    if (this.playIntent && backward) {
      if (!this.reverse.isRunning) await this.startReverse()
    } else {
      if (this.reverse.isRunning) this.reverse.stop()
      // A reverse preload window must be released back to the original before
      // forward play (an A-B loop proxy stays — forward play keeps looping it).
      if (this.proxy.isEngaged && !this.proxy.isLoopArmed) await this.proxy.disarm()
      await c.setProperty(MpvProperty.pause, !this.playIntent)
    }

    // Reflect the user's play/stop intent in the UI directly. During reverse mpv
    // is held paused and may emit no `pause` change (it was already paused), so
    // the store can't learn the play state from observed properties alone —
    // without this the play/pause button shows + toggles the wrong state.
    this.deps.store.update((s) => ({ ...s, playback: { ...s.playback, paused: !this.playIntent } }))
  }

  /**
   * Begins backward stepping. On an engaged A-B loop proxy the loop IS the whole
   * (all-intra) clip, so stepping is already cheap and wraps forever. Otherwise
   * we preload an all-intra window around the playhead so whole-file reverse is
   * smooth too; if no proxy can be built (no mpv binary) we fall back to stepping
   * the original directly with the loop-derived bounds.
   */
  private async startReverse(atSeconds?: number): Promise<void> {
    if (this.proxy.isEngaged && this.proxy.isLoopArmed) {
      await this.reverse.start(proxyReverseBounds(this.proxy.loopLengthSeconds))
      return
    }
    const ctx = this.originalContext()
    const pos = atSeconds ?? this.deps.store.getState().playback.position
    const length = ctx ? await this.proxy.armReverseWindow(pos, ctx) : 0
    // Building the window awaited; the user may have paused or flipped direction
    // meanwhile. Don't start stepping against a stale intent — release the freshly
    // engaged window so forward play isn't left stuck on a 20s slice.
    const { loopReverse } = this.deps.store.getState().playback
    if (!this.playIntent || !loopReverse) {
      if (length > 0 && this.proxy.isEngaged && !this.proxy.isLoopArmed) await this.proxy.disarm()
      return
    }
    await this.reverse.start(
      length > 0
        ? { floor: 0, wrapTo: null } // window: slide/stop is handled by extendReverse
        : computeReverseBounds(this.deps.store.getState().playback),
      // Seed the driver with the known head position so it never reads the fresh
      // swap's still-settling `time-pos`: a reverse window is engaged at its end
      // (proxy-local `length`); the original fallback steps from `pos`.
      length > 0 ? length : pos
    )
  }

  /**
   * The reverse driver reached the start of the current preload window. Slide to
   * the previous window if there's earlier video; at the file start, wrap to the
   * end for a whole-file loop, else stop. Returns the next bounds, or null to
   * finish. (Only used for reverse *windows*; an A-B loop proxy wraps in-bounds.)
   */
  private async extendReverse(): Promise<ReverseBounds | null> {
    const windowStart = this.proxy.reverseWindowStartSeconds
    if (windowStart === null) return null
    const ctx = this.originalContext()
    if (!ctx) return null

    if (windowStart > 0) {
      const length = await this.proxy.armReverseWindow(windowStart, ctx)
      return length > 0 ? { floor: 0, wrapTo: null } : null
    }
    // Reached the file start: a whole-file loop wraps to the end; otherwise stop.
    if (this.deps.store.getState().playback.loopMode === 'file') {
      const length = await this.proxy.armReverseWindow(ctx.durationSeconds, ctx)
      return length > 0 ? { floor: 0, wrapTo: null } : null
    }
    return null
  }

  /** Snapshot of the currently loaded media, or null when idle. */
  private originalContext(): OriginalContext | null {
    const { playback } = this.deps.store.getState()
    if (!playback.filePath) return null
    return {
      path: playback.filePath,
      durationSeconds: playback.duration,
      frameCount: playback.frameCount,
      fps: playback.fps
    }
  }

  /**
   * Reverse walked back to the start with no wrap target (whole-file reverse,
   * no loop): stop advancing but keep the backward direction armed, and reflect
   * the paused state in the UI (mpv is already held paused by the driver).
   */
  private onReverseReachedStart(): void {
    this.playIntent = false
    this.deps.store.update((s) => ({ ...s, playback: { ...s.playback, paused: true } }))
  }

  /**
   * Remaps an observed mpv property for the UI. While the reverse driver is
   * stepping, mpv is held internally paused — but the user is *playing backward*,
   * so report `pause=false` (the driver pauses mpv, not the user). While a proxy
   * plays, properties are also remapped into original-file terms so the UI keeps
   * showing the whole clip. Identity otherwise.
   */
  remapObservedProperty(name: string, value: unknown): { name: string; value: unknown } {
    if (name === MpvProperty.pause && this.reverse.isRunning) {
      return { name, value: false }
    }
    const session = this.proxy.session
    return session ? remapObservedToOriginal(name, value, session) : { name, value }
  }

  private setReverseFlag(reverse: boolean): void {
    this.deps.store.update((s) => ({
      ...s,
      playback: { ...s.playback, loopReverse: reverse }
    }))
  }

  /** Stops the reverse driver and removes any proxy; call on teardown. */
  dispose(): void {
    this.reverse.stop()
    this.proxy.dispose()
  }

  /**
   * Writes a lossless PNG of the current frame to `path` (from decoded video
   * pixels). Used both by the direct-save screenshot and by the editor capture,
   * which writes to a temp file it then reads back. No-op if the engine is down.
   */
  async screenshotTo(path: string): Promise<void> {
    const engine = this.deps.engine
    if (!engine?.isReady) return
    const operations = mapActionToOperations({ type: 'screenshot' }, { screenshotPath: path })
    await executeOperations(engine.controller, operations)
  }

  /** Builds the path for the next screenshot, ensuring the folder exists. */
  private resolveScreenshotPath(): string {
    const { playback } = this.deps.store.getState()
    const dir = this.deps.screenshotDir()
    mkdirSync(dir, { recursive: true })
    return buildScreenshotPath(dir, playback.filePath, playback.frame)
  }

  /**
   * Reflects actions that have no single observable mpv property. The
   * horizontal flip is applied via a video filter, which mpv does not surface
   * as a property. Loop mode is a composite of several mpv properties that only
   * we ever change, so we mirror the user's intent directly rather than parsing
   * `inf`/`no`/numbers back out of mpv.
   */
  private applyUiOnlyState(action: PlayerAction): void {
    if (action.type === 'toggleFlipH') {
      this.deps.store.update((s) => ({ ...s, video: { ...s.video, flipH: !s.video.flipH } }))
    } else if (action.type === 'resetImage') {
      this.deps.store.update((s) => ({ ...s, video: { ...s.video, flipH: false } }))
    } else if (action.type === 'setLoop') {
      this.deps.store.update((s) => ({
        ...s,
        playback: {
          ...s.playback,
          loopMode: action.mode,
          loopStart: action.start,
          loopEnd: action.end
        }
      }))
    }
  }
}
