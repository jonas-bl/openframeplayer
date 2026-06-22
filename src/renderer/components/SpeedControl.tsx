import { IconButton } from './IconButton'
import { SpeedIcon } from './icons'
import { formatSpeed } from '../lib/format'
import { SPEED_DEFAULT, SPEED_MAX, SPEED_MIN, SPEED_STEP } from '@shared/player-state'
import { usePlayerStore, selectPlayback } from '../state/playerStore'

const clamp = (v: number): number => Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(v * 100) / 100))

/**
 * Playback-speed stepper for the transport bar: slower / faster around the
 * current rate, with the readout doubling as a reset-to-1× button. Mirrors the
 * keyboard / Ctrl+scroll bindings, which go through the same `setSpeed` action.
 */
export function SpeedControl(): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const { speed } = usePlayerStore(selectPlayback)

  return (
    <div className="flex items-center" title="Playback speed (Ctrl + scroll)">
      <SpeedIcon size={16} className="mr-1 text-zinc-400" />
      <IconButton
        label="Slow down"
        size="sm"
        disabled={speed <= SPEED_MIN}
        onClick={() => dispatch({ type: 'setSpeed', value: clamp(speed - SPEED_STEP) })}
      >
        <span className="text-lg leading-none">−</span>
      </IconButton>
      <button
        type="button"
        title="Reset to 1×"
        onClick={() => dispatch({ type: 'setSpeed', value: SPEED_DEFAULT })}
        className="w-12 rounded px-1 py-0.5 text-center font-mono text-xs tabular-nums text-zinc-200 hover:bg-surface-600"
      >
        {formatSpeed(speed)}
      </button>
      <IconButton
        label="Speed up"
        size="sm"
        disabled={speed >= SPEED_MAX}
        onClick={() => dispatch({ type: 'setSpeed', value: clamp(speed + SPEED_STEP) })}
      >
        <span className="text-lg leading-none">+</span>
      </IconButton>
    </div>
  )
}
