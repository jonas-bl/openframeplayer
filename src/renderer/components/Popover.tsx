import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A button that toggles a small floating panel above it — used by the
 * transport-bar menus (tracks, playlist). Opens upward since it lives in the
 * bottom bar; closes on outside-click or Escape. Keep the trigger compact; the
 * panel sizes to its content.
 */
export function Popover({
  trigger,
  label,
  triggerClassName = '',
  children,
  align = 'left',
  panelClassName = ''
}: {
  trigger: (open: boolean) => ReactNode
  /** Accessible label / tooltip for the trigger button. */
  label: string
  triggerClassName?: string
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  panelClassName?: string
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          open
            ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
            : 'text-zinc-300 hover:bg-surface-600 hover:text-white'
        } ${triggerClassName}`}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={`absolute bottom-full z-40 mb-2 max-h-72 overflow-y-auto rounded-lg border border-surface-600 bg-surface-800 p-1 shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
