import { IconButton } from './IconButton'
import {
  NewWindowIcon,
  PenIcon,
  FocusIcon,
  TargetLockIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FlipIcon,
  RotateIcon,
  CameraIcon,
  ResetIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  PopoutIcon,
  PinIcon,
  GearIcon
} from './icons'
import { usePlayerStore, selectVideo } from '../state/playerStore'
import { useUiStore } from '../state/uiStore'
import { useAnnotationStore } from '../state/annotationStore'
import { useCommands } from '../commands/useCommands'
import { useFeatureVisible } from '../hooks/useMode'

const ZOOM_STEP = 0.2

/** mpv `video-zoom` is log2; convert to a human percentage for display. */
function zoomPercent(zoom: number): number {
  return Math.round(Math.pow(2, zoom) * 100)
}

/**
 * Tool + image-correction cluster, embedded inline in the transport bar after
 * the timecode so it fills the empty space below the timeline. Holds the image
 * panel toggle, new window, the video tool toggles (draw / autofocus /
 * keep-centred) and — only when the image panel is visible for the mode — the
 * zoom, flip and reset controls. Brightness / contrast grading lives in the Pro
 * analysis dock (see AdjustPanel). The whole group wraps to the next line when
 * the window is too narrow to fit it.
 *
 * @param showToolToggles Show the draw / autofocus / keep-centred toggles. On in
 *   the pop-out too — annotation control state is synced across the group, so
 *   toggling here drives the video overlay.
 */
export function ToolControls({
  showToolToggles = true
}: {
  showToolToggles?: boolean
}): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const video = usePlayerStore(selectVideo)
  const run = useCommands()

  const toolMode = useAnnotationStore((s) => s.toolMode)
  const keepCentered = useAnnotationStore((s) => s.keepCentered)

  const showImagePanel = useFeatureVisible('imagePanel')
  const showNewWindow = useFeatureVisible('newWindow')
  const showDrawTools = useFeatureVisible('drawTools')

  return (
    <>
      <div className="flex items-center gap-0.5">
        {showNewWindow && (
          <IconButton label="New window (N)" size="sm" onClick={() => run('newWindow')}>
            <NewWindowIcon size={16} />
          </IconButton>
        )}
        {showToolToggles && showDrawTools && (
          <>
            <IconButton
              label="Draw on video (B)"
              size="sm"
              active={toolMode === 'draw'}
              onClick={() => run('toggleDrawMode')}
            >
              <PenIcon size={16} />
            </IconButton>
            <IconButton
              label="Autofocus — click to centre (A)"
              size="sm"
              active={toolMode === 'autofocus'}
              onClick={() => run('toggleAutofocus')}
            >
              <FocusIcon size={16} />
            </IconButton>
            <IconButton
              label="Keep autofocus target centred (C)"
              size="sm"
              active={keepCentered}
              onClick={() => run('toggleKeepCentered')}
            >
              <TargetLockIcon size={16} />
            </IconButton>
          </>
        )}
      </div>

      {showImagePanel && (
        <>
          <span className="h-6 w-px bg-surface-600" />

          <div className="flex items-center gap-1">
            <IconButton
              label="Zoom out (-)"
              size="sm"
              onClick={() => dispatch({ type: 'nudgeZoom', delta: -ZOOM_STEP })}
            >
              <ZoomOutIcon size={16} />
            </IconButton>
            <span className="w-11 text-center font-mono text-xs tabular-nums text-zinc-300">
              {zoomPercent(video.zoom)}%
            </span>
            <IconButton
              label="Zoom in (+)"
              size="sm"
              onClick={() => dispatch({ type: 'nudgeZoom', delta: ZOOM_STEP })}
            >
              <ZoomInIcon size={16} />
            </IconButton>
          </div>

          <IconButton
            label="Flip horizontal (F)"
            size="sm"
            active={video.flipH}
            onClick={() => dispatch({ type: 'toggleFlipH' })}
          >
            <FlipIcon size={16} />
          </IconButton>
          <IconButton
            label="Rotate 90° clockwise"
            size="sm"
            active={video.rotate !== 0}
            onClick={() => dispatch({ type: 'setRotation', degrees: video.rotate + 90 })}
          >
            <RotateIcon size={16} />
          </IconButton>
          <IconButton
            label="Reset corrections (R)"
            size="sm"
            onClick={() => dispatch({ type: 'resetImage' })}
          >
            <ResetIcon size={16} />
          </IconButton>
        </>
      )}
    </>
  )
}

/**
 * Screenshot + window-chrome cluster, embedded at the far right of the transport
 * bar's control row (after the loop / speed / volume group).
 *
 * @param showWindowActions Show fullscreen and the pop-out toggle. Off in the
 *   pop-out controls window, where they're nonsensical — fullscreen would
 *   fullscreen the little controls window, and the pop-out already has its own ×
 *   to return the controls. Screenshot and settings show in both windows.
 */
export function WindowActions({
  showWindowActions = true
}: {
  showWindowActions?: boolean
}): JSX.Element {
  const run = useCommands()
  const fullscreen = useUiStore((s) => s.fullscreen)
  const popoutOpen = useUiStore((s) => s.popoutOpen)
  const alwaysOnTop = useUiStore((s) => s.alwaysOnTop)

  const showScreenshot = useFeatureVisible('screenshot')
  const showPopout = useFeatureVisible('popout')

  return (
    <div className="flex items-center gap-0.5">
      {showScreenshot && (
        <IconButton
          label="Screenshot — click to edit, Ctrl+click to save (S)"
          size="sm"
          onClick={(e) => run(e.ctrlKey ? 'screenshot' : 'screenshotEditor')}
        >
          <CameraIcon size={16} />
        </IconButton>
      )}
      {showWindowActions && (
        <>
          <IconButton
            label={alwaysOnTop ? 'Always on top — on (T)' : 'Always on top (T)'}
            size="sm"
            active={alwaysOnTop}
            onClick={() => run('toggleAlwaysOnTop')}
          >
            <PinIcon size={16} />
          </IconButton>
          <IconButton
            label={fullscreen ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'}
            size="sm"
            active={fullscreen}
            onClick={() => run('toggleFullscreen')}
          >
            {fullscreen ? <FullscreenExitIcon size={16} /> : <FullscreenIcon size={16} />}
          </IconButton>
          {showPopout && (
            <IconButton
              label={popoutOpen ? 'Return controls (P)' : 'Pop out controls (P)'}
              size="sm"
              active={popoutOpen}
              onClick={() => run('popoutControls')}
            >
              <PopoutIcon size={16} />
            </IconButton>
          )}
        </>
      )}
      <IconButton label="Settings (,)" size="sm" onClick={() => run('openSettings')}>
        <GearIcon size={16} />
      </IconButton>
    </div>
  )
}
