import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { WHEEL_DOWN, WHEEL_UP } from '@shared/commands'
import { usePlayerStore } from '../state/playerStore'
import { useSettingsStore } from '../state/settingsStore'
import { chordModifier, matchCommand } from './useKeyboardShortcuts'

/** Drag beyond this many pixels counts as a pan, not a click. */
const CLICK_THRESHOLD_PX = 4
/** Zoom change per wheel notch (mpv video-zoom is log2). */
const WHEEL_ZOOM_STEP = 0.15
/** Two taps within this window count as a double-click (reset view). */
const DOUBLE_TAP_MS = 260

interface DragState {
  startX: number
  startY: number
  startPanX: number
  startPanY: number
  moved: boolean
}

interface VideoGestureHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onWheel: (e: WheelEvent<HTMLElement>) => void
}

/**
 * Mouse gestures over the video surface (Feature 1):
 *   - drag  → pan (mpv `video-pan-x/y`, in window fractions so it tracks 1:1)
 *   - wheel → zoom in/out (mpv `video-zoom`)
 *   - click (no drag) → toggle play/pause
 *
 * Pan starts from the current pan so successive drags accumulate naturally.
 * Reads live state via the store's `getState` to avoid re-subscribing.
 */
export function useVideoGestures(): VideoGestureHandlers {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const keybindings = useSettingsStore((s) => s.settings.keybindings)
  const drag = useRef<DragState | null>(null)
  const lastTapAt = useRef(0)
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    const { video } = usePlayerStore.getState().state
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: video.panX,
      startPanY: video.panY,
      moved: false
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const state = drag.current
    if (!state) return
    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY
    if (!state.moved && Math.hypot(dx, dy) < CLICK_THRESHOLD_PX) return

    state.moved = true
    const rect = e.currentTarget.getBoundingClientRect()
    dispatch({
      type: 'setPan',
      x: state.startPanX + dx / rect.width,
      y: state.startPanY + dy / rect.height
    })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>): void => {
    const state = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!state || state.moved) return

    // Distinguish single (play/pause) from double (reset view) tap. The single
    // action is deferred briefly so a double-tap can cancel it.
    const now = Date.now()
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      if (pendingTap.current) clearTimeout(pendingTap.current)
      pendingTap.current = null
      lastTapAt.current = 0
      dispatch({ type: 'resetView' })
    } else {
      lastTapAt.current = now
      pendingTap.current = setTimeout(() => {
        pendingTap.current = null
        dispatch({ type: 'playPause' })
      }, DOUBLE_TAP_MS)
    }
  }

  const onWheel = (e: WheelEvent<HTMLElement>): void => {
    // A modified wheel (Ctrl/Alt + scroll) is a bindable chord handled globally
    // by useWheelShortcuts (which can preventDefault the browser zoom — React's
    // onWheel is passive, so it can't). Here we only handle the plain wheel.
    if (chordModifier(e)) return

    // The wheel only zooms if it is currently *bound* to zoom (the default, but
    // the user can rebind it). Other plain-wheel commands are run globally by
    // useWheelShortcuts; we keep zoom here so it can anchor to the cursor.
    const command = matchCommand(
      { key: e.deltaY < 0 ? WHEEL_UP : WHEEL_DOWN, modifier: null },
      keybindings
    )
    if (command !== 'zoomIn' && command !== 'zoomOut') return

    const dz = command === 'zoomIn' ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP
    const { video } = usePlayerStore.getState().state
    const rect = e.currentTarget.getBoundingClientRect()

    // Keep the point under the cursor fixed while zooming.
    // mpv scales around centre then pans by a window fraction, so for a screen
    // offset o (fraction from centre) and zoom ratio r = 2^dz:
    //   pan' = o·(1 − r) + r·pan
    const ratio = Math.pow(2, dz)
    const ox = (e.clientX - (rect.left + rect.width / 2)) / rect.width
    const oy = (e.clientY - (rect.top + rect.height / 2)) / rect.height

    dispatch({ type: 'setZoom', value: video.zoom + dz })
    dispatch({
      type: 'setPan',
      x: ox * (1 - ratio) + ratio * video.panX,
      y: oy * (1 - ratio) + ratio * video.panY
    })
  }

  return { onPointerDown, onPointerMove, onPointerUp, onWheel }
}
