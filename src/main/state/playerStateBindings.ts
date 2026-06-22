import type { PlayerState } from '@shared/player-state'
import { MpvProperty } from '../mpv/mpvProperties'

/**
 * The mpv properties we observe so the UI can mirror them. Registered once at
 * startup via `observeProperties`; each change flows through
 * {@link applyPropertyChange} into the central PlayerState.
 */
export const OBSERVED_PROPERTIES: string[] = [
  MpvProperty.pause,
  MpvProperty.mute,
  MpvProperty.volume,
  MpvProperty.speed,
  MpvProperty.timePos,
  MpvProperty.duration,
  MpvProperty.frameNumber,
  MpvProperty.frameCount,
  MpvProperty.fps,
  MpvProperty.path,
  MpvProperty.brightness,
  MpvProperty.contrast,
  MpvProperty.videoZoom,
  MpvProperty.videoPanX,
  MpvProperty.videoPanY
]

/** Coerces an mpv value to a finite number, falling back to a default. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Coerces an mpv value to a boolean. */
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Folds a single observed mpv property change into a new PlayerState.
 *
 * Pure (returns a fresh object, mutates nothing) so the mpv -> UI mapping is
 * unit-testable and free of ordering surprises. Unknown property names pass
 * through unchanged, which keeps the function forward-compatible if we observe
 * more properties later.
 */
export function applyPropertyChange(
  state: PlayerState,
  name: string,
  value: unknown
): PlayerState {
  const { playback, video } = state

  switch (name) {
    case MpvProperty.pause:
      return patchPlayback(state, { paused: bool(value, playback.paused) })
    case MpvProperty.mute:
      return patchPlayback(state, { muted: bool(value, playback.muted) })
    case MpvProperty.volume:
      return patchPlayback(state, { volume: num(value, playback.volume) })
    case MpvProperty.speed:
      return patchPlayback(state, { speed: num(value, playback.speed) })
    case MpvProperty.timePos:
      return patchPlayback(state, { position: num(value, playback.position) })
    case MpvProperty.duration:
      return patchPlayback(state, { duration: num(value, playback.duration) })
    case MpvProperty.frameNumber:
      return patchPlayback(state, { frame: num(value, playback.frame) })
    case MpvProperty.frameCount:
      return patchPlayback(state, { frameCount: num(value, playback.frameCount) })
    case MpvProperty.fps:
      return patchPlayback(state, { fps: num(value, playback.fps) })
    case MpvProperty.path:
      return patchPlayback(state, {
        filePath: typeof value === 'string' ? value : null
      })

    case MpvProperty.brightness:
      return patchVideo(state, { brightness: num(value, video.brightness) })
    case MpvProperty.contrast:
      return patchVideo(state, { contrast: num(value, video.contrast) })
    case MpvProperty.videoZoom:
      return patchVideo(state, { zoom: num(value, video.zoom) })
    case MpvProperty.videoPanX:
      return patchVideo(state, { panX: num(value, video.panX) })
    case MpvProperty.videoPanY:
      return patchVideo(state, { panY: num(value, video.panY) })

    default:
      return state
  }
}

function patchPlayback(state: PlayerState, patch: Partial<PlayerState['playback']>): PlayerState {
  return { ...state, playback: { ...state.playback, ...patch } }
}

function patchVideo(state: PlayerState, patch: Partial<PlayerState['video']>): PlayerState {
  return { ...state, video: { ...state.video, ...patch } }
}
