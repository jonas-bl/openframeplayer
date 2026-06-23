import type { PlayerState, TrackInfo, PlaylistEntry } from '@shared/player-state'
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
  MpvProperty.videoPanY,
  MpvProperty.videoRotate,
  MpvProperty.trackList,
  MpvProperty.sid,
  MpvProperty.aid,
  MpvProperty.vid,
  MpvProperty.playlist,
  MpvProperty.playlistPos
]

/** Coerces an mpv value to a finite number, falling back to a default. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Coerces an mpv value to a boolean. */
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** A selected track id is a number, or `false`/`'no'`/absent when disabled. */
function trackId(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Coerces an mpv `track-list` value into our typed, UI-facing shape. */
function coerceTracks(value: unknown): TrackInfo[] {
  if (!Array.isArray(value)) return []
  const out: TrackInfo[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const t = raw as Record<string, unknown>
    const type = t.type
    if ((type !== 'audio' && type !== 'video' && type !== 'sub') || typeof t.id !== 'number') continue
    out.push({
      id: t.id,
      type,
      title: str(t.title),
      lang: str(t.lang),
      selected: bool(t.selected, false),
      external: bool(t.external, false)
    })
  }
  return out
}

/** Coerces an mpv `playlist` value into our typed, UI-facing shape. */
function coercePlaylist(value: unknown): PlaylistEntry[] {
  if (!Array.isArray(value)) return []
  const out: PlaylistEntry[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const e = raw as Record<string, unknown>
    if (typeof e.filename !== 'string') continue
    out.push({
      filename: e.filename,
      title: str(e.title),
      current: bool(e.current, false) || bool(e.playing, false)
    })
  }
  return out
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
    case MpvProperty.videoRotate:
      return patchVideo(state, { rotate: num(value, video.rotate) })

    case MpvProperty.trackList:
      return patchPlayback(state, { tracks: coerceTracks(value) })
    case MpvProperty.sid:
      return patchPlayback(state, { sid: trackId(value) })
    case MpvProperty.aid:
      return patchPlayback(state, { aid: trackId(value) })
    case MpvProperty.vid:
      return patchPlayback(state, { vid: trackId(value) })
    case MpvProperty.playlist:
      return patchPlayback(state, { playlist: coercePlaylist(value) })
    case MpvProperty.playlistPos:
      return patchPlayback(state, { playlistPos: num(value, playback.playlistPos) })

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
