import { useCallback } from 'react'
import type { AppCommand } from '@shared/commands'
import { SPEED_DEFAULT, SPEED_MAX, SPEED_MIN, SPEED_STEP } from '@shared/player-state'
import { usePlayerStore } from '../state/playerStore'
import { useUiStore } from '../state/uiStore'
import { useAnnotationStore } from '../state/annotationStore'
import { useMarkersStore, nextMarkerTime, prevMarkerTime } from '../state/markersStore'

const ZOOM_STEP = 0.2

/** Nudges the current playback speed by `delta`, clamped to the allowed range. */
function nudgeSpeed(delta: number): void {
  const { speed } = usePlayerStore.getState().state.playback
  const next = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round((speed + delta) * 100) / 100))
  usePlayerStore.getState().dispatch({ type: 'setSpeed', value: next })
}

/**
 * Toggles looping on/off. The loop's scope follows the current selection: if an
 * A-B selection is set it loops that section, otherwise it loops the whole
 * video. Turning looping off keeps the A-B marks so the selection persists and
 * can be re-looped (clear them with `clearLoop`).
 */
function toggleLoop(): void {
  const { dispatch, state } = usePlayerStore.getState()
  const { loopMode, loopStart, loopEnd } = state.playback
  const hasSelection = loopStart !== null && loopEnd !== null
  const mode = loopMode === 'off' ? (hasSelection ? 'ab' : 'file') : 'off'
  dispatch({ type: 'setLoop', mode, start: loopStart, end: loopEnd })
}

/** Marks one end of the A-B loop at the current position, arming `ab` mode. */
function setLoopEdge(edge: 'start' | 'end'): void {
  const { dispatch, state } = usePlayerStore.getState()
  const { position, loopStart, loopEnd } = state.playback
  dispatch({
    type: 'setLoop',
    mode: 'ab',
    start: edge === 'start' ? position : loopStart,
    end: edge === 'end' ? position : loopEnd
  })
}

/** Flips the persistent play-direction (forward ↔ backward); see ReverseDriver. */
function toggleLoopReverse(): void {
  const { dispatch, state } = usePlayerStore.getState()
  dispatch({ type: 'setLoopReverse', reverse: !state.playback.loopReverse })
}

/** Jumps to the marker just after / before the playhead (no-op if none). */
function jumpMarker(direction: 'next' | 'prev'): void {
  const { dispatch, state } = usePlayerStore.getState()
  const { markers } = useMarkersStore.getState()
  const pos = state.playback.position
  const target = direction === 'next' ? nextMarkerTime(markers, pos) : prevMarkerTime(markers, pos)
  if (target !== null) dispatch({ type: 'seekAbsolute', seconds: target, precise: true })
}

/**
 * Returns `runCommand`, the single place that turns an {@link AppCommand} into
 * its effect. Both keyboard shortcuts and toolbar buttons go through here, so a
 * command behaves identically however it is triggered.
 */
export function useCommands(): (command: AppCommand) => void {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const openFile = usePlayerStore((s) => s.openFile)
  const openSettings = useUiStore((s) => s.openSettings)

  return useCallback(
    (command: AppCommand) => {
      switch (command) {
        case 'playPause':
          return dispatch({ type: 'playPause' })
        case 'frameBack':
          return dispatch({ type: 'frameBackStep' })
        case 'frameForward':
          return dispatch({ type: 'frameStep' })
        case 'speedUp':
          return nudgeSpeed(SPEED_STEP)
        case 'speedDown':
          return nudgeSpeed(-SPEED_STEP)
        case 'speedReset':
          return dispatch({ type: 'setSpeed', value: SPEED_DEFAULT })
        case 'toggleLoop':
          return toggleLoop()
        case 'setLoopStart':
          return setLoopEdge('start')
        case 'setLoopEnd':
          return setLoopEdge('end')
        case 'clearLoop':
          return dispatch({ type: 'setLoop', mode: 'off', start: null, end: null })
        case 'toggleLoopReverse':
          return toggleLoopReverse()
        case 'addMarker':
          return useMarkersStore.getState().add(usePlayerStore.getState().state.playback.position)
        case 'nextMarker':
          return jumpMarker('next')
        case 'prevMarker':
          return jumpMarker('prev')
        case 'zoomIn':
          return dispatch({ type: 'nudgeZoom', delta: ZOOM_STEP })
        case 'zoomOut':
          return dispatch({ type: 'nudgeZoom', delta: -ZOOM_STEP })
        case 'resetView':
          return dispatch({ type: 'resetView' })
        case 'screenshot':
          return dispatch({ type: 'screenshot' })
        case 'screenshotEditor':
          return window.api.openScreenshotEditor()
        case 'flipHorizontal':
          return dispatch({ type: 'toggleFlipH' })
        case 'resetImage':
          return dispatch({ type: 'resetImage' })
        case 'toggleDrawMode':
          return useAnnotationStore.getState().toggleToolMode('draw')
        case 'toggleAutofocus':
          return useAnnotationStore.getState().toggleToolMode('autofocus')
        case 'toggleKeepCentered':
          return useAnnotationStore.getState().toggleKeepCentered()
        case 'undoAnnotation':
          return useAnnotationStore.getState().undo()
        case 'clearAnnotations':
          return useAnnotationStore.getState().clear()
        case 'openFile':
          return void openFile()
        case 'newWindow':
          return window.api.newWindow()
        case 'toggleFullscreen':
          return window.windowControls.toggleFullscreen()
        case 'toggleAlwaysOnTop':
          return window.windowControls.toggleAlwaysOnTop()
        case 'popoutControls':
          return window.api.setControlsPopout(!useUiStore.getState().popoutOpen)
        case 'openSettings':
          return openSettings()
      }
    },
    [dispatch, openFile, openSettings]
  )
}
