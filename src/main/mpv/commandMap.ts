import type { PlayerAction } from '@shared/player-actions'
import { SPEED_MAX, SPEED_MIN } from '@shared/player-state'
import type { MpvScalar } from './protocol'
import { MpvProperty } from './mpvProperties'

/**
 * A single concrete instruction for mpv: either set a property or run a
 * command. The command map turns each semantic {@link PlayerAction} into a
 * list of these, which a thin executor then sends over IPC.
 */
export type MpvOperation =
  | { kind: 'set'; property: string; value: MpvScalar }
  | { kind: 'command'; args: MpvScalar[] }

/** Side inputs the map needs that aren't carried by the action itself. */
export interface CommandMapContext {
  /** Absolute path the next screenshot is written to (resolved by main). */
  screenshotPath: string
}

const setProp = (property: string, value: MpvScalar): MpvOperation => ({
  kind: 'set',
  property,
  value
})
const run = (...args: MpvScalar[]): MpvOperation => ({ kind: 'command', args })

/**
 * THE central command-mapping module (per the architecture brief): UI action
 * in, mpv operations out. It is pure — no IPC, no state mutation — so every
 * mapping is trivially unit-testable, and no mpv property names ever leak into
 * the renderer.
 *
 * Toggles prefer mpv's stateless `cycle`/`vf toggle`/`add` commands so we don't
 * depend on a possibly-stale local copy of the value.
 */
export function mapActionToOperations(
  action: PlayerAction,
  ctx: CommandMapContext
): MpvOperation[] {
  switch (action.type) {
    // --- File / transport ---
    case 'load':
      return [run('loadfile', action.path, 'replace')]
    case 'playPause':
      return [run('cycle', MpvProperty.pause)]
    case 'setPaused':
      return [setProp(MpvProperty.pause, action.paused)]
    case 'seekAbsolute':
      // Keyframe seeks are near-instant (no decode-to-target); exact is
      // frame-accurate but must decode from the keyframe up to the frame.
      return [run('seek', action.seconds, 'absolute', action.precise === false ? 'keyframes' : 'exact')]
    case 'seekRelative':
      return [run('seek', action.seconds, 'relative', 'exact')]
    case 'frameStep':
      return [run('frame-step')]
    case 'frameBackStep':
      return [run('frame-back-step')]
    case 'setVolume':
      return [setProp(MpvProperty.volume, clamp(action.value, 0, 100))]
    case 'toggleMute':
      return [run('cycle', MpvProperty.mute)]
    case 'setSpeed':
      return [setProp(MpvProperty.speed, clamp(action.value, SPEED_MIN, SPEED_MAX))]

    // --- Looping ---
    // `mode` drives all three properties at once so an explicit, self-contained
    // mpv state results regardless of the previous mode. `'no'` clears an
    // mpv loop property; a number arms it (seconds).
    case 'setLoop':
      return [
        setProp(MpvProperty.loopFile, action.mode === 'file' ? 'inf' : 'no'),
        setProp(
          MpvProperty.abLoopA,
          action.mode === 'ab' && action.start !== null ? action.start : 'no'
        ),
        setProp(
          MpvProperty.abLoopB,
          action.mode === 'ab' && action.end !== null ? action.end : 'no'
        )
      ]
    // Reverse playback is NOT a property change. Native `play-direction=backward`
    // deadlocks the decoder and freezes the IPC queue, so it's driven from the
    // main process by stepping frames backward (see ReverseDriver). PlayerService
    // intercepts this action and starts/stops that driver; the pure map emits
    // nothing.
    case 'setLoopReverse':
      return []

    // --- Zoom / pan (Feature 1) ---
    case 'setZoom':
      return [setProp(MpvProperty.videoZoom, action.value)]
    case 'nudgeZoom':
      return [run('add', MpvProperty.videoZoom, action.delta)]
    case 'setPan':
      return [
        setProp(MpvProperty.videoPanX, action.x),
        setProp(MpvProperty.videoPanY, action.y)
      ]

    // --- Image correction (Features 4 & 5) ---
    case 'setBrightness':
      return [setProp(MpvProperty.brightness, clamp(action.value, -100, 100))]
    case 'setContrast':
      return [setProp(MpvProperty.contrast, clamp(action.value, -100, 100))]
    case 'toggleFlipH':
      return [run('vf', 'toggle', 'hflip')]

    // --- Capture (Feature 3): lossless PNG from decoded video pixels ---
    case 'screenshot':
      return [run('screenshot-to-file', ctx.screenshotPath, 'video')]

    // --- Reset (Shortcut R): neutral image, drop the flip filter ---
    case 'resetImage':
      return [
        setProp(MpvProperty.brightness, 0),
        setProp(MpvProperty.contrast, 0),
        setProp(MpvProperty.videoZoom, 0),
        setProp(MpvProperty.videoPanX, 0),
        setProp(MpvProperty.videoPanY, 0),
        run('vf', 'remove', 'hflip')
      ]

    // --- Reset view geometry only: zoom + pan (double-click / Shortcut D) ---
    case 'resetView':
      return [
        setProp(MpvProperty.videoZoom, 0),
        setProp(MpvProperty.videoPanX, 0),
        setProp(MpvProperty.videoPanY, 0)
      ]

    default:
      return assertExhaustive(action)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Compile-time guarantee that every action variant is handled above. */
function assertExhaustive(action: never): never {
  throw new Error(`Unhandled player action: ${JSON.stringify(action)}`)
}
