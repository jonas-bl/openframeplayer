import { useEffect } from 'react'
import type { TrackingEngine } from '@shared/settings'
import { usePlayerStore } from '../state/playerStore'
import { useAnnotationStore } from '../state/annotationStore'
import { useSettingsStore } from '../state/settingsStore'
import { contentToScreen, screenToContent, panToCenter, type Vec2 } from '../lib/videoTransform'
import { createTracker } from '../tracking/createTracker'
import { boxCenter, clampBox, type Box, type Frame, type Tracker } from '../tracking/types'

/** Tracking cadence (~12 fps): plenty for following, cheap on the GPU/CPU. */
const INTERVAL_MS = 80
/** Capture downscale: longer side in px (matches main-process default). */
const CAPTURE_MAX = 426
/** Focus tracker template size (content-ish fraction). */
const FOCUS_BOX = 0.08
/** Min follow-box size so dot-like drawings still seed a usable template. */
const MIN_BOX = 0.04
/** Pan smoothing toward the keep-centred target (0..1). */
const FOCUS_LERP = 0.5
const FOCUS_KEY = '__focus__'

interface Entry {
  tracker: Tracker | null
  /** Prior subject position in content space, for delta application. */
  prev: Vec2 | null
  needsInit: boolean
  creating: boolean
}

interface View {
  pan: Vec2
  zoom: number
}

function currentView(): View {
  const v = usePlayerStore.getState().state.video
  return { pan: { x: v.panX, y: v.panY }, zoom: v.zoom }
}

/** Screen-fraction bounding box of an annotation's content points. */
function followInitBox(points: Vec2[], view: View): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const a = contentToScreen({ x: minX, y: minY }, view.pan, view.zoom)
  const b = contentToScreen({ x: maxX, y: maxY }, view.pan, view.zoom)
  let x = Math.min(a.x, b.x)
  let y = Math.min(a.y, b.y)
  let w = Math.abs(b.x - a.x)
  let h = Math.abs(b.y - a.y)
  if (w < MIN_BOX) {
    x -= (MIN_BOX - w) / 2
    w = MIN_BOX
  }
  if (h < MIN_BOX) {
    y -= (MIN_BOX - h) / 2
    h = MIN_BOX
  }
  return clampBox({ x, y, w, h })
}

/**
 * Drives motion tracking each tick: pulls a downscaled frame of the video and
 * advances a tracker for every motion-follow drawing (so it glides with its
 * subject) and for the keep-centred autofocus target (nudging the view to keep
 * the subject centred). All math is done in content space, so user pan/zoom
 * never confuses the tracker. Trackers are created lazily and disposed when
 * their target goes away or the engine changes.
 */
export function useTracking(hasFile: boolean): void {
  useEffect(() => {
    if (!hasFile) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let engine: TrackingEngine = useSettingsStore.getState().settings.trackingEngine
    const entries = new Map<string, Entry>()

    const disposeAll = (): void => {
      for (const e of entries.values()) e.tracker?.dispose()
      entries.clear()
    }

    /** Lazily creates the tracker for a key; returns the (possibly pending) entry. */
    const entryFor = (key: string): Entry => {
      let e = entries.get(key)
      if (!e) {
        e = { tracker: null, prev: null, needsInit: false, creating: true }
        entries.set(key, e)
        const usedEngine = engine
        void createTracker(engine).then((t) => {
          if (stopped || entries.get(key) !== e || engine !== usedEngine) {
            t.dispose()
            return
          }
          e!.tracker = t
          e!.creating = false
          e!.needsInit = true
        })
      }
      return e
    }

    const stepFollow = (frame: Frame, view: View): void => {
      const store = useAnnotationStore.getState()
      const follows = store.annotations.filter((a) => a.anchor === 'follow')
      const live = new Set(follows.map((a) => a.id))

      // Drop trackers whose annotation was removed.
      for (const key of [...entries.keys()]) {
        if (key !== FOCUS_KEY && !live.has(key)) {
          entries.get(key)?.tracker?.dispose()
          entries.delete(key)
        }
      }

      for (const a of follows) {
        const e = entryFor(a.id)
        if (!e.tracker) continue
        if (e.needsInit) {
          e.tracker.init(frame, followInitBox(a.points, view))
          e.prev = screenToContent(boxCenter(followInitBox(a.points, view)), view.pan, view.zoom)
          e.needsInit = false
          continue
        }
        const box = e.tracker.update(frame)
        if (!box || !e.prev) continue
        const now = screenToContent(boxCenter(box), view.pan, view.zoom)
        store.moveAnnotation(a.id, now.x - e.prev.x, now.y - e.prev.y)
        e.prev = now
      }
    }

    const stepFocus = (frame: Frame, view: View): void => {
      const store = useAnnotationStore.getState()
      if (!store.keepCentered || !store.focusPoint) {
        const e = entries.get(FOCUS_KEY)
        if (e) {
          e.tracker?.dispose()
          entries.delete(FOCUS_KEY)
        }
        return
      }
      const e = entryFor(FOCUS_KEY)
      if (!e.tracker) return
      if (e.needsInit) {
        const c = contentToScreen(store.focusPoint, view.pan, view.zoom)
        e.tracker.init(frame, clampBox({ x: c.x - FOCUS_BOX / 2, y: c.y - FOCUS_BOX / 2, w: FOCUS_BOX, h: FOCUS_BOX }))
        e.prev = store.focusPoint
        e.needsInit = false
        return
      }
      const box = e.tracker.update(frame)
      if (!box) return
      const now = screenToContent(boxCenter(box), view.pan, view.zoom)
      store.setFocusPoint(now)
      // Nudge the view so the tracked point drifts toward centre (smoothed).
      const target = panToCenter(now, view.zoom)
      const dispatch = usePlayerStore.getState().dispatch
      dispatch({
        type: 'setPan',
        x: view.pan.x + (target.x - view.pan.x) * FOCUS_LERP,
        y: view.pan.y + (target.y - view.pan.y) * FOCUS_LERP
      })
    }

    const tick = async (): Promise<void> => {
      if (stopped) return
      try {
        const liveEngine = useSettingsStore.getState().settings.trackingEngine
        if (liveEngine !== engine) {
          engine = liveEngine
          disposeAll()
        }

        const store = useAnnotationStore.getState()
        const needs = store.annotations.some((a) => a.anchor === 'follow') || (store.keepCentered && !!store.focusPoint)
        if (needs) {
          const frame = await window.api.captureFrame(CAPTURE_MAX)
          if (frame && frame.data && frame.w > 0 && frame.h > 0) {
            const view = currentView()
            stepFollow(frame, view)
            stepFocus(frame, view)
          }
        } else if (entries.size) {
          disposeAll()
        }
      } catch (err) {
        console.warn('[tracking] tick failed:', err)
      }
      if (!stopped) timer = setTimeout(() => void tick(), INTERVAL_MS)
    }

    void tick()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      disposeAll()
    }
  }, [hasFile])
}
