import { useRef, useState } from 'react'
import { IconButton } from './IconButton'
import {
  PenIcon,
  LineIcon,
  RectIcon,
  EllipseIcon,
  ArrowIcon,
  UndoIcon,
  TrashIcon,
  GripIcon,
  PlusIcon
} from './icons'
import { useAnnotationStore, DRAW_COLORS, type DrawTool } from '../state/annotationStore'
import { useSettingsStore } from '../state/settingsStore'

const TOOLS: { tool: DrawTool; label: string; Icon: typeof PenIcon }[] = [
  { tool: 'pen', label: 'Freehand', Icon: PenIcon },
  { tool: 'line', label: 'Line', Icon: LineIcon },
  { tool: 'rect', label: 'Rectangle', Icon: RectIcon },
  { tool: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowIcon }
]

const WIDTHS = [2, 4, 8]
/** Cap on how many custom colour slots the palette keeps. */
const MAX_CUSTOM_COLORS = 6

/**
 * Floating drawing palette, shown only while the draw tool is active: a drag
 * handle to reposition it, shape picker, colour swatches (presets + custom
 * slots), stroke width, anchor mode, undo and clear.
 */
export function DrawingToolbar(): JSX.Element {
  const { tool, color, strokeWidth, annotations, drawAnchor } = useAnnotationStore()
  const setTool = useAnnotationStore((s) => s.setTool)
  const setColor = useAnnotationStore((s) => s.setColor)
  const setStrokeWidth = useAnnotationStore((s) => s.setStrokeWidth)
  const setDrawAnchor = useAnnotationStore((s) => s.setDrawAnchor)
  const undo = useAnnotationStore((s) => s.undo)
  const clear = useAnnotationStore((s) => s.clear)

  const customColors = useSettingsStore((s) => s.settings.customDrawColors)

  const ref = useRef<HTMLDivElement>(null)
  // null until first drag: shows centred at the top; afterwards an absolute
  // position within the video region the palette is mounted in.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  /** Adds (or promotes) a colour into the persisted custom slots and selects it. */
  const useCustomColor = (c: string): void => {
    setColor(c)
    const next = [c, ...customColors.filter((x) => x !== c)].slice(0, MAX_CUSTOM_COLORS)
    void window.api.updateSettings({ customDrawColors: next })
  }

  const startDrag = (e: React.PointerEvent): void => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const parent = (el.offsetParent as HTMLElement | null) ?? document.body
    const prect = parent.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const offX = e.clientX - rect.left
    const offY = e.clientY - rect.top

    const onMove = (ev: PointerEvent): void => {
      const maxX = parent.clientWidth - rect.width
      const maxY = parent.clientHeight - rect.height
      const x = Math.max(0, Math.min(ev.clientX - prect.left - offX, Math.max(0, maxX)))
      const y = Math.max(0, Math.min(ev.clientY - prect.top - offY, Math.max(0, maxY)))
      setPos({ x, y })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`pointer-events-auto absolute flex items-center gap-2 rounded-xl border border-surface-600 bg-surface-800/95 px-2 py-1.5 shadow-2xl backdrop-blur ${
        pos ? '' : 'left-1/2 top-3 -translate-x-1/2'
      }`}
    >
      <button
        type="button"
        aria-label="Drag toolbar"
        title="Drag to move"
        onPointerDown={startDrag}
        className="flex h-7 w-5 cursor-grab items-center justify-center text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
      >
        <GripIcon size={16} />
      </button>

      <span className="h-5 w-px bg-surface-600" />

      <div className="flex items-center gap-0.5">
        {TOOLS.map(({ tool: t, label, Icon }) => (
          <IconButton key={t} label={label} size="sm" active={tool === t} onClick={() => setTool(t)}>
            <Icon size={16} />
          </IconButton>
        ))}
      </div>

      <span className="h-5 w-px bg-surface-600" />

      <div className="flex items-center gap-1">
        {DRAW_COLORS.map((c) => (
          <Swatch key={c} c={c} active={color === c} onClick={() => setColor(c)} />
        ))}
        {customColors.map((c) => (
          <Swatch key={c} c={c} active={color === c} onClick={() => setColor(c)} />
        ))}
        <label
          title="Pick a custom colour"
          className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-500 text-zinc-400 hover:border-zinc-300 hover:text-zinc-200"
        >
          <PlusIcon size={12} />
          <input
            type="color"
            aria-label="Pick a custom colour"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => useCustomColor(e.target.value)}
          />
        </label>
      </div>

      <span className="h-5 w-px bg-surface-600" />

      <div className="flex items-center gap-1">
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            aria-label={`Width ${w}`}
            title={`Width ${w}`}
            onClick={() => setStrokeWidth(w)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              strokeWidth === w ? 'bg-accent/20 ring-1 ring-accent/40' : 'hover:bg-surface-600'
            }`}
          >
            <span className="rounded-full bg-zinc-200" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-surface-600" />

      <div className="flex items-center rounded-lg bg-surface-900 p-0.5 text-[11px] font-medium">
        {(['steady', 'follow'] as const).map((a) => (
          <button
            key={a}
            type="button"
            title={a === 'steady' ? 'Glue drawing to the frame' : 'Make drawing track a moving subject'}
            onClick={() => setDrawAnchor(a)}
            className={`rounded-md px-2 py-1 capitalize transition-colors ${
              drawAnchor === a ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-surface-600" />

      <div className="flex items-center gap-0.5">
        <IconButton label="Undo" size="sm" disabled={annotations.length === 0} onClick={undo}>
          <UndoIcon size={16} />
        </IconButton>
        <IconButton label="Clear all" size="sm" disabled={annotations.length === 0} onClick={clear}>
          <TrashIcon size={16} />
        </IconButton>
      </div>
    </div>
  )
}

/** A round, selectable colour swatch. */
function Swatch({
  c,
  active,
  onClick
}: {
  c: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={`Colour ${c}`}
      title={c}
      onClick={onClick}
      style={{ backgroundColor: c }}
      className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
        active ? 'border-white ring-2 ring-accent' : 'border-black/30'
      }`}
    />
  )
}
