import type { Vec2 } from '../lib/videoTransform'
import type { DrawTool } from '../state/annotationStore'

/** The minimal geometry an SVG shape needs to render (tool + style + points). */
export interface ShapeData {
  tool: DrawTool
  color: string
  /** Stroke width in screen px (constant regardless of zoom). */
  width: number
  /** Points in some space; projected to pixels via `toPx`. */
  points: Vec2[]
}

/**
 * Renders a single annotation as SVG, in pixel space via the supplied
 * projection. Shared by the live video {@link import('./AnnotationOverlay')}
 * overlay and the screenshot editor so both draw shapes identically.
 */
export function Shape({
  shape,
  toPx
}: {
  shape: ShapeData
  toPx: (n: Vec2) => Vec2
}): JSX.Element | null {
  const { tool, color, width, points } = shape
  const pts = points.map(toPx)
  const common = {
    stroke: color,
    strokeWidth: width,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  if (tool === 'pen') {
    if (pts.length === 1) {
      return <circle cx={pts[0].x} cy={pts[0].y} r={width / 2} fill={color} />
    }
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return <path d={d} {...common} />
  }

  if (pts.length < 2) return null
  const [p0, p1] = pts

  switch (tool) {
    case 'line':
      return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} />
    case 'rect':
      return (
        <rect
          x={Math.min(p0.x, p1.x)}
          y={Math.min(p0.y, p1.y)}
          width={Math.abs(p1.x - p0.x)}
          height={Math.abs(p1.y - p0.y)}
          {...common}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          cx={(p0.x + p1.x) / 2}
          cy={(p0.y + p1.y) / 2}
          rx={Math.abs(p1.x - p0.x) / 2}
          ry={Math.abs(p1.y - p0.y) / 2}
          {...common}
        />
      )
    case 'arrow':
      return <Arrow p0={p0} p1={p1} color={color} width={width} common={common} />
    default:
      return null
  }
}

function Arrow({
  p0,
  p1,
  color,
  width,
  common
}: {
  p0: Vec2
  p1: Vec2
  color: string
  width: number
  common: Record<string, unknown>
}): JSX.Element {
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x)
  const head = Math.max(10, width * 3)
  const spread = Math.PI / 7
  const b1 = { x: p1.x - head * Math.cos(angle - spread), y: p1.y - head * Math.sin(angle - spread) }
  const b2 = { x: p1.x - head * Math.cos(angle + spread), y: p1.y - head * Math.sin(angle + spread) }
  return (
    <g>
      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} />
      <polygon points={`${p1.x},${p1.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`} fill={color} />
    </g>
  )
}

/**
 * Draws an annotation onto a Canvas2D context (image-pixel coordinates),
 * mirroring {@link Shape}. Used by the editor to bake drawings into the saved
 * PNG at full resolution.
 */
export function drawShapeToCanvas(ctx: CanvasRenderingContext2D, shape: ShapeData): void {
  const { tool, color, width, points } = shape
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'pen') {
    if (points.length === 1) {
      ctx.beginPath()
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (points.length >= 2) {
    const [p0, p1] = points
    switch (tool) {
      case 'line':
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        break
      case 'rect':
        ctx.strokeRect(
          Math.min(p0.x, p1.x),
          Math.min(p0.y, p1.y),
          Math.abs(p1.x - p0.x),
          Math.abs(p1.y - p0.y)
        )
        break
      case 'ellipse':
        ctx.beginPath()
        ctx.ellipse(
          (p0.x + p1.x) / 2,
          (p0.y + p1.y) / 2,
          Math.abs(p1.x - p0.x) / 2,
          Math.abs(p1.y - p0.y) / 2,
          0,
          0,
          Math.PI * 2
        )
        ctx.stroke()
        break
      case 'arrow': {
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x)
        const head = Math.max(10, width * 3)
        const spread = Math.PI / 7
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p1.x - head * Math.cos(angle - spread), p1.y - head * Math.sin(angle - spread))
        ctx.lineTo(p1.x - head * Math.cos(angle + spread), p1.y - head * Math.sin(angle + spread))
        ctx.closePath()
        ctx.fill()
        break
      }
    }
  }
  ctx.restore()
}
