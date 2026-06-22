import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { usePlayerStore, selectVideo } from '../state/playerStore'
import { useAnnotationStore, type Annotation } from '../state/annotationStore'
import { Shape } from './shapes'
import {
  contentToScreen,
  screenToContent,
  panToCenter,
  zoomToFitRegion,
  type Vec2
} from '../lib/videoTransform'

/** Drag under this many px counts as a click (autofocus point vs. box). */
const CLICK_THRESHOLD_PX = 4

interface Size {
  w: number
  h: number
}

/**
 * Transparent SVG layer over the video region for drawing annotations and
 * autofocus. Inert (`pointer-events-none`) unless a tool is active, so normal
 * video gestures pass straight through. Geometry is stored in content space and
 * projected to pixels with the live zoom/pan, so drawings stay glued to the
 * frame ("steady") as the user pans and zooms.
 */
export function AnnotationOverlay(): JSX.Element | null {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [draft, setDraft] = useState<Annotation | null>(null)
  const [focusBox, setFocusBox] = useState<{ a: Vec2; b: Vec2 } | null>(null)

  const video = usePlayerStore(selectVideo)
  const dispatch = usePlayerStore((s) => s.dispatch)
  const {
    toolMode,
    tool,
    color,
    strokeWidth,
    drawAnchor,
    annotations,
    addAnnotation,
    keepCentered,
    setFocusPoint
  } = useAnnotationStore()

  // Track the rendered size so content fractions can be projected to pixels.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = (): void => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const interaction = useRef<{ start: Vec2; startPx: Vec2; moved: boolean } | null>(null)

  const view = { panX: video.panX, panY: video.panY, zoom: video.zoom }
  const pan = { x: view.panX, y: view.panY }

  /** Event → screen fraction (0..1 across the region). */
  const eventFraction = (e: ReactPointerEvent): Vec2 => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (toolMode === 'none') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const f = eventFraction(e)
    const content = screenToContent(f, pan, view.zoom)
    interaction.current = { start: content, startPx: { x: e.clientX, y: e.clientY }, moved: false }

    if (toolMode === 'draw') {
      setDraft({ id: 'draft', tool, color, width: strokeWidth, points: [content], anchor: drawAnchor })
    } else {
      setFocusBox({ a: f, b: f })
    }
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const it = interaction.current
    if (!it) return
    const moved =
      Math.hypot(e.clientX - it.startPx.x, e.clientY - it.startPx.y) >= CLICK_THRESHOLD_PX
    if (moved) it.moved = true

    const f = eventFraction(e)
    const content = screenToContent(f, pan, view.zoom)

    if (toolMode === 'draw') {
      setDraft((d) => {
        if (!d) return d
        // Freehand accumulates points; shapes keep just start + current corner.
        const points = d.tool === 'pen' ? [...d.points, content] : [d.points[0], content]
        return { ...d, points }
      })
    } else {
      setFocusBox((b) => (b ? { ...b, b: f } : b))
    }
  }

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const it = interaction.current
    interaction.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!it) return

    if (toolMode === 'draw') {
      const d = draft
      setDraft(null)
      if (!d) return
      // Commit unless a shape has no extent (a stray click).
      if (d.tool !== 'pen' && !it.moved) return
      addAnnotation({ tool: d.tool, color: d.color, width: d.width, points: d.points, anchor: d.anchor })
      return
    }

    // Autofocus: a click centres the point; a dragged box zooms to fit it.
    const box = focusBox
    setFocusBox(null)
    if (!it.moved || !box) {
      const p = panToCenter(it.start, view.zoom)
      dispatch({ type: 'setPan', x: p.x, y: p.y })
      if (keepCentered) setFocusPoint(it.start)
    } else {
      const next = zoomToFitRegion(box.a, box.b, view)
      dispatch({ type: 'setZoom', value: next.zoom })
      dispatch({ type: 'setPan', x: next.panX, y: next.panY })
      if (keepCentered) {
        const center = screenToContent(
          { x: (box.a.x + box.b.x) / 2, y: (box.a.y + box.b.y) / 2 },
          pan,
          view.zoom
        )
        setFocusPoint(center)
      }
    }
  }

  const active = toolMode !== 'none'
  const toPx = (n: Vec2): Vec2 => {
    const f = contentToScreen(n, pan, view.zoom)
    return { x: f.x * size.w, y: f.y * size.h }
  }

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 h-full w-full ${active ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {annotations.map((a) => (
        <Shape key={a.id} shape={a} toPx={toPx} />
      ))}
      {draft && <Shape shape={draft} toPx={toPx} />}
      {focusBox && (
        <rect
          x={Math.min(focusBox.a.x, focusBox.b.x) * size.w}
          y={Math.min(focusBox.a.y, focusBox.b.y) * size.h}
          width={Math.abs(focusBox.b.x - focusBox.a.x) * size.w}
          height={Math.abs(focusBox.b.y - focusBox.a.y) * size.h}
          fill="rgba(59,130,246,0.12)"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      )}
    </svg>
  )
}
