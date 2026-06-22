/**
 * Central player state shape.
 *
 * This is the single source of truth for the UI. The renderer holds an
 * authoritative copy (in the Zustand store) and the main process keeps mpv in
 * sync by translating {@link PlayerAction}s into mpv operations and by pushing
 * observed mpv property changes back up to the renderer.
 *
 * Field units intentionally mirror mpv's own property semantics so the
 * command map (main process) is a thin, lossless translation rather than a
 * place where conversion bugs can hide.
 */

/** Image-correction / geometry state — everything under "Bildkorrektur". */
export interface VideoState {
  /** mpv `brightness`, range -100..100, neutral 0. */
  brightness: number
  /** mpv `contrast`, range -100..100, neutral 0. */
  contrast: number
  /** mpv `video-zoom`, log2 scale: 0 = 100%, 1 = 200%, -1 = 50%. */
  zoom: number
  /** mpv `video-pan-x`, fraction -1..1 of the window width. */
  panX: number
  /** mpv `video-pan-y`, fraction -1..1 of the window height. */
  panY: number
  /** Horizontal flip toggle (mpv `vf toggle hflip`). */
  flipH: boolean
}

/**
 * Looping mode:
 *   - `off`  — no looping.
 *   - `file` — replay the whole file infinitely (mpv `loop-file=inf`).
 *   - `ab`   — loop the segment between {@link PlaybackState.loopStart} and
 *     {@link PlaybackState.loopEnd} (mpv `ab-loop-a` / `ab-loop-b`).
 */
export type LoopMode = 'off' | 'file' | 'ab'

/**
 * Smooth-loop proxy status (A-B loops only):
 *   - `off`       — no proxy; native ab-loop (small hitch at the wrap).
 *   - `preparing` — transcoding the loop segment to an all-intra clip.
 *   - `active`    — playing the proxy; looping + reverse are smooth.
 */
export type SmoothLoopStatus = 'off' | 'preparing' | 'active'

/** Transport / playback state. */
export interface PlaybackState {
  /** Currently loaded file path, or null when idle. */
  filePath: string | null
  /** mpv `pause`. */
  paused: boolean
  /** mpv `time-pos`, seconds. */
  position: number
  /** mpv `duration`, seconds. */
  duration: number
  /** mpv `estimated-frame-number` (best-effort current frame index). */
  frame: number
  /** mpv `estimated-frame-count` (best-effort total frame count). */
  frameCount: number
  /** Source frame rate (mpv `container-fps`), used for frame<->time math. */
  fps: number
  /** mpv `volume`, 0..100 (mpv allows >100 but we clamp in the UI). */
  volume: number
  /** mpv `mute`. */
  muted: boolean
  /** mpv `speed`, playback rate multiplier (1 = normal); clamped in the UI. */
  speed: number
  /** Active looping mode. */
  loopMode: LoopMode
  /** A-B loop in-point, seconds; null when unset. Used only in `ab` mode. */
  loopStart: number | null
  /** A-B loop out-point, seconds; null when unset. Used only in `ab` mode. */
  loopEnd: number | null
  /** Play backwards by frame-stepping (see ReverseDriver); opt-in. */
  loopReverse: boolean
  /** Smooth-loop proxy status for the active A-B loop. */
  smoothLoop: SmoothLoopStatus
  /**
   * The all-intra window (original-file seconds) currently preloaded for smooth
   * reverse, or null when none is engaged. Surfaced so the scrubber can show how
   * much footage is ready to reverse-play smoothly.
   */
  reverseWindow: { start: number; end: number } | null
}

/** Engine connection / health, surfaced so the UI can show clear errors. */
export interface EngineState {
  /** True once mpv is spawned and the IPC handshake succeeded. */
  ready: boolean
  /** Human-readable error for the UI; null when healthy. */
  error: string | null
}

export interface PlayerState {
  engine: EngineState
  playback: PlaybackState
  video: VideoState
}

export const DEFAULT_VIDEO_STATE: VideoState = {
  brightness: 0,
  contrast: 0,
  zoom: 0,
  panX: 0,
  panY: 0,
  flipH: false
}

export const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  filePath: null,
  paused: true,
  position: 0,
  duration: 0,
  frame: 0,
  frameCount: 0,
  fps: 0,
  volume: 100,
  muted: false,
  speed: 1,
  loopMode: 'off',
  loopStart: null,
  loopEnd: null,
  loopReverse: false,
  smoothLoop: 'off',
  reverseWindow: null
}

export const DEFAULT_ENGINE_STATE: EngineState = {
  ready: false,
  error: null
}

export const DEFAULT_PLAYER_STATE: PlayerState = {
  engine: DEFAULT_ENGINE_STATE,
  playback: DEFAULT_PLAYBACK_STATE,
  video: DEFAULT_VIDEO_STATE
}

/** Playback-speed bounds + step, shared by the UI and the command map. */
export const SPEED_MIN = 0.25
export const SPEED_MAX = 4
export const SPEED_STEP = 0.25
export const SPEED_DEFAULT = 1
