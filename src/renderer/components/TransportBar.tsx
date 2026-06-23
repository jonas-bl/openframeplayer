import { IconButton } from './IconButton'
import { SeekBar } from './SeekBar'
import { VolumeControl } from './VolumeControl'
import { SpeedControl } from './SpeedControl'
import { LoopControls } from './LoopControls'
import { TrackMenu } from './TrackMenu'
import { PlaylistMenu } from './PlaylistMenu'
import { MarkerMenu } from './MarkerMenu'
import { ExportMenu } from './ExportMenu'
import { ComparisonLink } from './ComparisonLink'
import { GoToFrame } from './GoToFrame'
import { ToolControls, WindowActions } from './ActionBar'
import { PlayIcon, PauseIcon, StepBackIcon, StepForwardIcon } from './icons'
import { formatTimecode, formatFrameCounter } from '../lib/format'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import { useMarkersStore } from '../state/markersStore'
import { useFeatureVisible } from '../hooks/useMode'
import { useThumbnails } from '../hooks/useThumbnails'

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
    filePath,
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
  const thumbs = useThumbnails(filePath, duration)

  // mpv's `estimated-frame-number` doesn't tick reliably, so derive the current
  // frame from the (reliable) playback position and source fps; fall back to the
  // observed values when fps is unknown (e.g. before a file loads).
  const fpsKnown = fps > 0
  const currentFrame = fpsKnown ? Math.round(position * fps) : frame
  const totalFrames = frameCount > 0 ? frameCount : fpsKnown ? Math.round(duration * fps) : 0

  const showFrameStep = useFeatureVisible('frameStep')
  const showFrameCounter = useFeatureVisible('frameCounter')
  const showLoop = useFeatureVisible('loop')
  const showTracks = useFeatureVisible('tracks')
  const showPlaylist = useFeatureVisible('playlist')
  const showMarkers = useFeatureVisible('markers')
  const showExport = useFeatureVisible('export')
  const showComparison = useFeatureVisible('comparison')
  const showGoToFrame = useFeatureVisible('goToFrame')
  const showSpeed = useFeatureVisible('speed')
  const markerTimes = useMarkersStore((s) => s.markers).map((m) => m.time)

  return (
    <div className="border-t border-surface-700 bg-surface-800/95 px-3 pb-2 pt-2 backdrop-blur">
      <SeekBar
        position={position}
        duration={duration}
        loopStart={loopStart}
        loopEnd={loopEnd}
        reverseWindow={reverseWindow}
        markers={showMarkers ? markerTimes : []}
        thumbnails={thumbs}
        onSeek={(seconds, precise) => dispatch({ type: 'seekAbsolute', seconds, precise })}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          {showFrameStep && (
            <IconButton
              label="Previous frame (←)"
              onClick={() => dispatch({ type: 'frameBackStep' })}
            >
              <StepBackIcon />
            </IconButton>
          )}
          <IconButton
            label={paused ? 'Play (Space)' : 'Pause (Space)'}
            onClick={() => dispatch({ type: 'playPause' })}
          >
            {paused ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
          </IconButton>
          {showFrameStep && (
            <IconButton label="Next frame (→)" onClick={() => dispatch({ type: 'frameStep' })}>
              <StepForwardIcon />
            </IconButton>
          )}
        </div>

        <div className="flex items-baseline gap-2 font-mono text-xs text-zinc-300">
          <span className="tabular-nums">
            {formatTimecode(position)}{' '}
            <span className="text-zinc-500">/ {formatTimecode(duration)}</span>
          </span>
          {showFrameCounter && (
            <>
              <span className="text-zinc-500">·</span>
              <span className="tabular-nums text-zinc-400" title="Current frame / total frames">
                f {formatFrameCounter(currentFrame, totalFrames)}
              </span>
            </>
          )}
        </div>

        {showGoToFrame && <GoToFrame />}

        <ToolControls showToolToggles={showToolToggles} />

        <div className="ml-auto flex items-center gap-3">
          {showLoop && (
            <>
              <LoopControls />
              <span className="h-6 w-px bg-surface-600" />
            </>
          )}
          {showSpeed && <SpeedControl />}
          <VolumeControl />
          {(showTracks || showPlaylist || showMarkers || showExport) && (
            <span className="h-6 w-px bg-surface-600" />
          )}
          {showMarkers && <MarkerMenu />}
          {showExport && <ExportMenu />}
          {showTracks && <TrackMenu />}
          {showPlaylist && <PlaylistMenu />}
          <span className="h-6 w-px bg-surface-600" />
          {showComparison && showWindowActions && <ComparisonLink />}
          <WindowActions showWindowActions={showWindowActions} />
        </div>
      </div>
    </div>
  )
}
