import type { WindowEdge } from '@shared/ipc'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface MinSize {
  width: number
  height: number
}

/**
 * Computes a window's new bounds while resizing from a given edge/corner.
 *
 * Dragging a west/north edge moves the origin; east/south edges only grow the
 * size. Clamping to the minimum size keeps the opposite edge fixed (so a window
 * never "walks" when you shrink it past the minimum). Pure and unit-tested.
 *
 * @param dx,dy - cursor movement in screen pixels since the resize began
 */
export function resizeRect(
  start: Rect,
  edge: WindowEdge,
  dx: number,
  dy: number,
  min: MinSize
): Rect {
  let { x, y, width, height } = start

  if (edge.includes('e')) width = start.width + dx
  if (edge.includes('s')) height = start.height + dy
  if (edge.includes('w')) {
    width = start.width - dx
    x = start.x + dx
  }
  if (edge.includes('n')) {
    height = start.height - dy
    y = start.y + dy
  }

  if (width < min.width) {
    if (edge.includes('w')) x -= min.width - width // keep the east edge fixed
    width = min.width
  }
  if (height < min.height) {
    if (edge.includes('n')) y -= min.height - height // keep the south edge fixed
    height = min.height
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}
