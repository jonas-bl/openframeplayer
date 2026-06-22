/**
 * Pure mapping between the on-screen video region and "content" space — the
 * coordinate frame that pans/zooms with the video. Annotations and autofocus
 * targets are stored in content space (per-axis fraction `0..1` of the region at
 * zoom=0/pan=0) so they stay glued to the frame as the user pans and zooms.
 *
 * Derived from, and consistent with, the cursor-anchored zoom in
 * `useVideoGestures.ts` (`pan' = o·(1−r) + r·pan`). All values are unitless
 * fractions; mpv `video-pan-x/y` use the same per-axis window-fraction units.
 */

export interface Vec2 {
  x: number
  y: number
}

/** Linear zoom scale for an mpv log2 `video-zoom`. */
export function zoomScale(zoom: number): number {
  return Math.pow(2, zoom)
}

/** Screen fraction (`0..1` across the region) → content fraction, one axis. */
export function screenToContentAxis(f: number, pan: number, zoom: number): number {
  return 0.5 + (f - 0.5 - pan) / zoomScale(zoom)
}

/** Content fraction → screen fraction (`0..1` across the region), one axis. */
export function contentToScreenAxis(n: number, pan: number, zoom: number): number {
  return 0.5 + (n - 0.5) * zoomScale(zoom) + pan
}

/** Pan that moves content point `n` to the screen centre (`f = 0.5`), one axis. */
export function panToCenterAxis(n: number, zoom: number): number {
  return -(n - 0.5) * zoomScale(zoom)
}

export function screenToContent(p: Vec2, pan: Vec2, zoom: number): Vec2 {
  return {
    x: screenToContentAxis(p.x, pan.x, zoom),
    y: screenToContentAxis(p.y, pan.y, zoom)
  }
}

export function contentToScreen(n: Vec2, pan: Vec2, zoom: number): Vec2 {
  return {
    x: contentToScreenAxis(n.x, pan.x, zoom),
    y: contentToScreenAxis(n.y, pan.y, zoom)
  }
}

/** Pan (both axes) that centres content point `n` at the current zoom. */
export function panToCenter(n: Vec2, zoom: number): Vec2 {
  return { x: panToCenterAxis(n.x, zoom), y: panToCenterAxis(n.y, zoom) }
}

export interface ViewTransform {
  zoom: number
  panX: number
  panY: number
}

/**
 * Given a box drawn in screen-fraction coords (two opposite corners) and the
 * current view, returns the zoom + pan that makes that region fill the view
 * (contain fit, uniform scale). Used by autofocus "draw a box to zoom in".
 *
 * `maxZoom` caps the result so a tiny box can't zoom to absurd levels.
 */
export function zoomToFitRegion(
  corner0: Vec2,
  corner1: Vec2,
  current: ViewTransform,
  maxZoom = 4
): ViewTransform {
  // Box in content space (independent of current pan/zoom).
  const c0 = screenToContent(corner0, { x: current.panX, y: current.panY }, current.zoom)
  const c1 = screenToContent(corner1, { x: current.panX, y: current.panY }, current.zoom)

  // Guard against degenerate (tiny) boxes.
  const wn = Math.max(1e-3, Math.abs(c1.x - c0.x))
  const hn = Math.max(1e-3, Math.abs(c1.y - c0.y))
  const center = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 }

  // Uniform scale that contains the box; clamp to maxZoom.
  const scale = Math.min(1 / wn, 1 / hn)
  const zoom = Math.min(maxZoom, Math.log2(scale))

  const pan = panToCenter(center, zoom)
  return { zoom, panX: pan.x, panY: pan.y }
}
