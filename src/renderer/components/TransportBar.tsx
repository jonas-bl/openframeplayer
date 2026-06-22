import { IconButton } from './IconButton'
import { SeekBar } from './SeekBar'
import { VolumeControl } from './VolumeControl'
import { SpeedControl } from './SpeedControl'
import { LoopControls } from './LoopControls'
import { ToolControls, WindowActions } from './ActionBar'
import { PlayIcon, PauseIcon, StepBackIcon, StepForwardIcon } from './icons'
import { formatTimecode, formatFrameCounter } from '../lib/format'
import { usePlayerStore, selectPlayback } from '../state/playerStore'

interface TransportBarProps {
  /** Show fullscreen + pop-out chrome. Off in the pop-out controls window. */
  showWindowActions?: boolean
  /** Show the draw / autofocus / keep-centred tool toggles. */
  showToolToggles?: boolean
}

/**
 * The single bottom control bar: the scrubber on top, then one wrapping row of
 * everything else. Frame stepping, play/pause and the time + frame readout sit
 * on the left; the tool + image-correction controls fill the gap after them; and
 * the loop / speed / volume group plus screenshot and window chrome anchor to the
 * right. When the window is wide enough it's all one line below the timeline; on
 * narrow widths the clusters wrap. Opaque so it reads clearly over the video.
 */
export function TransportBar({
  showWindowActions = true,
  showToolToggles = true
}: TransportBarProps): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const playback = usePlayerStore(selectPlayback)
  const {
    paused,
    position,
    duration,
    frame,
    frameCount,
    fps,
    loopStart,
    loopEnd,
    reverseWindow
  } = playback

  // mpv's `estimated-frame-number` doesn't tick reliably, so derive the current
  // frame from the (reliable) playback position and source fps; fall back to the
  // observed values when fps is unknown (e.g. before a file loads).
  const fpsKnown = fps > 0
  const currentFrame = fpsKnown ? Math.round(position * fps) : frame
  const totalFrames = frameCount > 0 ? frameCount : fpsKnown ? Math.round(duration * fps) : 0

  return (
    <div className="border-t border-surface-700 bg-surface-800/95 px-3 pb-2 pt-2 backdrop-blur">
      <SeekBar
        position={position}
        duration={duration}
        loopStart={loopStart}
        loopEnd={loopEnd}
        reverseWindow={reverseWindow}
        onSeek={(seconds, precise) => dispatch({ type: 'seekAbsolute', seconds, precise })}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <IconButton
            label="Previous frame (←)"
            onClick={() => dispatch({ type: 'frameBackStep' })}
          >
            <StepBackIcon />
          </IconButton>
          <IconButton
            label={paused ? 'Play (Space)' : 'Pause (Space)'}
            onClick={() => dispatch({ type: 'playPause' })}
          >
            {paused ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
          </IconButton>
          <IconButton label="Next frame (→)" onClick={() => dispatch({ type: 'frameStep' })}>
            <StepForwardIcon />
          </IconButton>
        </div>

        <div className="flex items-baseline gap-2 font-mono text-xs text-zinc-300">
          <span className="tabular-nums">
            {formatTimecode(position)}{' '}
            <span className="text-zinc-500">/ {formatTimecode(duration)}</span>
          </span>
          <span className="text-zinc-500">·</span>
          <span className="tabular-nums text-zinc-400" title="Current frame / total frames">
            f {formatFrameCounter(currentFrame, totalFrames)}
          </span>
        </div>

        <ToolControls showToolToggles={showToolToggles} />

        <div className="ml-auto flex items-center gap-3">
          <LoopControls />
          <span className="h-6 w-px bg-surface-600" />
          <SpeedControl />
          <VolumeControl />
          <span className="h-6 w-px bg-surface-600" />
          <WindowActions showWindowActions={showWindowActions} />
        </div>
      </div>
    </div>
  )
}
