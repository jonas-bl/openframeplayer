import { useEffect, useRef, useState } from 'react'
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
import { useAnnotationStore, type DrawTool } from '../state/annotationStore'
import { useSettingsStore } from '../state/settingsStore'

const TOOLS: { tool: DrawTool; label: string; Icon: typeof PenIcon }[] = [
  { tool: 'pen', label: 'Freehand', Icon: PenIcon },
  { tool: 'line', label: 'Line', Icon: LineIcon },
  { tool: 'rect', label: 'Rectangle', Icon: RectIcon },
  { tool: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowIcon }
]

const WIDTHS = [2, 4, 8]
/** Cap on how many colour slots the palette keeps. */
const MAX_COLORS = 12

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

  const colors = useSettingsStore((s) => s.settings.customDrawColors)

  const ref = useRef<HTMLDivElement>(null)
  // null until first drag: shows centred at the top; afterwards an absolute
  // position within the video region the palette is mounted in.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const persistColors = (next: string[]): void => {
    void window.api.updateSettings({ customDrawColors: next })
  }

  /** Recolours a slot in place (no new slot is created) and selects it. */
  const editSlot = (index: number, c: string): void => {
    const next = colors.map((existing, i) => (i === index ? c : existing))
    persistColors(next)
    setColor(c)
  }

  /** Appends a new slot with the picked colour and selects it. */
  const addSlot = (c: string): void => {
    if (colors.length >= MAX_COLORS) return
    persistColors([...colors, c])
    setColor(c)
  }

  /** Removes a slot; the palette always keeps at least one colour. */
  const removeSlot = (index: number): void => {
    if (colors.length <= 1) return
    persistColors(colors.filter((_, i) => i !== index))
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
        {colors.map((c, i) => (
          <Swatch
            key={i}
            c={c}
            active={color === c}
            onSelect={() => setColor(c)}
            onEdit={(v) => editSlot(i, v)}
            onRemove={colors.length > 1 ? () => removeSlot(i) : undefined}
          />
        ))}
        {colors.length < MAX_COLORS && <AddSwatch onAdd={addSlot} />}
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

/**
 * A hidden native colour input that reports only the *committed* value.
 *
 * React's `onChange` for `<input type="color">` maps to the DOM `input` event,
 * which fires continuously as the user drags inside the OS picker — that's what
 * made a single pick spawn several slots. We listen to the native `change`
 * event instead, which fires exactly once when the picker is committed.
 */
function useCommitColor(
  ref: React.RefObject<HTMLInputElement>,
  onCommit: (value: string) => void
): void {
  const cb = useRef(onCommit)
  cb.current = onCommit
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (): void => cb.current(el.value)
    el.addEventListener('change', handler)
    return () => el.removeEventListener('change', handler)
  }, [ref])
}

const HIDDEN_INPUT_CLASS = 'pointer-events-none absolute h-0 w-0 opacity-0'

/**
 * A round colour swatch that is both selectable (click) and editable
 * (double-click, or the hover pencil, opens the OS colour picker). Editing
 * recolours this slot in place and persists it. A hover × removes the slot.
 */
function Swatch({
  c,
  active,
  onSelect,
  onEdit,
  onRemove
}: {
  c: string
  active: boolean
  onSelect: () => void
  onEdit: (value: string) => void
  onRemove?: () => void
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useCommitColor(inputRef, onEdit)

  const openPicker = (): void => {
    const el = inputRef.current
    if (!el) return
    el.value = c
    el.click()
  }

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Colour ${c}`}
        title={`${c} — double-click to recolour`}
        onClick={onSelect}
        onDoubleClick={openPicker}
        style={{ backgroundColor: c }}
        className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
          active ? 'border-white ring-2 ring-accent' : 'border-black/30'
        }`}
      />
      <input ref={inputRef} type="color" defaultValue={c} tabIndex={-1} aria-hidden className={HIDDEN_INPUT_CLASS} />
      <button
        type="button"
        aria-label="Recolour swatch"
        title="Recolour"
        onClick={openPicker}
        className="absolute -bottom-1 -right-1 hidden h-3 w-3 items-center justify-center rounded-full border border-surface-800 bg-surface-600 text-zinc-200 group-hover:flex hover:bg-surface-500"
      >
        <PenIcon size={7} />
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove swatch"
          title="Remove"
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-3 w-3 items-center justify-center rounded-full border border-surface-800 bg-surface-600 text-[9px] leading-none text-zinc-200 group-hover:flex hover:bg-rose-600"
        >
          ×
        </button>
      )}
    </span>
  )
}

/** The dashed "+" slot: opens the OS picker and appends one new colour. */
function AddSwatch({ onAdd }: { onAdd: (value: string) => void }): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useCommitColor(inputRef, onAdd)

  return (
    <button
      type="button"
      aria-label="Add a colour"
      title="Add a colour"
      onClick={() => {
        const el = inputRef.current
        if (!el) return
        el.value = '#ffffff'
        el.click()
      }}
      className="relative flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-500 text-zinc-400 hover:border-zinc-300 hover:text-zinc-200"
    >
      <PlusIcon size={12} />
      <input ref={inputRef} type="color" defaultValue="#ffffff" tabIndex={-1} aria-hidden className={HIDDEN_INPUT_CLASS} />
    </button>
  )
}
