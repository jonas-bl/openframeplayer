import { IconButton } from './IconButton'
import { Slider } from './Slider'
import { VolumeIcon, MuteIcon } from './icons'
import { usePlayerStore, selectPlayback } from '../state/playerStore'

/** Mute toggle plus a volume slider, wired to the player store. */
export function VolumeControl(): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const { volume, muted } = usePlayerStore(selectPlayback)

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={muted ? 'Unmute' : 'Mute'}
        size="sm"
        active={muted}
        onClick={() => dispatch({ type: 'toggleMute' })}
      >
        {muted ? <MuteIcon size={18} /> : <VolumeIcon size={18} />}
      </IconButton>
      <Slider
        label="Volume"
        min={0}
        max={100}
        value={muted ? 0 : volume}
        onChange={(value) => dispatch({ type: 'setVolume', value })}
        className="w-20"
      />
    </div>
  )
}
