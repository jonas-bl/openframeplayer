/**
 * Annotation *control* state — the drawing/autofocus tool settings shared across
 * a player window group (overlay + pop-out controls) so toggling draw, pen
 * colour, autofocus, keep-centred, etc. in the pop-out drives the video overlay.
 *
 * Only the controls are shared. The drawn annotations and the autofocus point
 * stay renderer-local to the overlay (the pop-out has no video to draw on).
 */

/** The active interaction over the video surface. */
export type ToolMode = 'none' | 'draw' | 'autofocus'

/** Drawing primitives. `pen` is freehand; the rest are two-point shapes. */
export type DrawTool = 'pen' | 'line' | 'rect' | 'ellipse' | 'arrow'

/** `steady` glues a drawing to the frame; `follow` makes it track a subject. */
export type Anchor = 'steady' | 'follow'

/** The synced subset of the annotation store. */
export interface AnnotationControl {
  toolMode: ToolMode
  tool: DrawTool
  color: string
  strokeWidth: number
  drawAnchor: Anchor
  keepCentered: boolean
}

export const DEFAULT_ANNOTATION_CONTROL: AnnotationControl = {
  toolMode: 'none',
  tool: 'pen',
  color: '#ef4444',
  strokeWidth: 3,
  drawAnchor: 'steady',
  keepCentered: false
}
