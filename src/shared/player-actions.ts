import type { LoopMode } from './player-state'

/**
 * The semantic vocabulary the UI uses to drive playback.
 *
 * The renderer NEVER references mpv property names or commands directly; it
 * only dispatches these high-level actions across the IPC bridge. The main
 * process owns the single translation point (see `main/mpv/commandMap.ts`)
 * that turns each action into concrete mpv operations.
 *
 * Keeping this as a discriminated union gives us exhaustive `switch` checks in
 * the mapper, so adding an action is a compile-time prompt to handle it.
 */
export type PlayerAction =
  // --- File / transport ---
  | { type: 'load'; path: string }
  | { type: 'playPause' }
  | { type: 'setPaused'; paused: boolean }
  // `precise: false` does a fast keyframe seek (snaps to the nearest keyframe,
  // shows a frame instantly) — used for live scrubbing. Omit / true for a
  // frame-accurate hr-seek, used on release and for everything else.
  | { type: 'seekAbsolute'; seconds: number; precise?: boolean }
  | { type: 'seekRelative'; seconds: number }
  | { type: 'frameStep' }
  | { type: 'frameBackStep' }
  | { type: 'setVolume'; value: number }
  | { type: 'toggleMute' }
  | { type: 'setSpeed'; value: number }
  // --- Looping ---
  // One action fully describes the loop config so the (pure) command map can
  // translate it deterministically without needing the prior loop state.
  | { type: 'setLoop'; mode: LoopMode; start: number | null; end: number | null }
  | { type: 'setLoopReverse'; reverse: boolean }
  // --- Zoom / pan (Feature 1) ---
  | { type: 'setZoom'; value: number }
  | { type: 'nudgeZoom'; delta: number }
  | { type: 'setPan'; x: number; y: number }
  // --- Image correction (Features 4 & 5) ---
  | { type: 'setBrightness'; value: number }
  | { type: 'setContrast'; value: number }
  | { type: 'toggleFlipH' }
  // --- Capture (Feature 3) ---
  | { type: 'screenshot' }
  // --- Reset image corrections (Shortcut R) ---
  | { type: 'resetImage' }
  // --- Reset only the view geometry: zoom + pan (double-click / Shortcut D) ---
  | { type: 'resetView' }

export type PlayerActionType = PlayerAction['type']
