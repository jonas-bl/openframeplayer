import { useEffect, useState, type ReactNode } from 'react'
import { FullscreenIcon, FullscreenExitIcon } from './icons'

interface WindowButtonsProps {
  /** Include a fullscreen toggle (placed before the maximize button). */
  fullscreen?: boolean
  /** Button height in px; match the host title strip. Default 32. */
  height?: number
  /** Custom close handler; defaults to closing the sending window. */
  onClose?: () => void
}

/**
 * Compact minimize / (fullscreen) / maximize-restore / close buttons for the
 * frameless secondary windows (screenshot editor, pop-out controls). They drive
 * the window that sent the IPC via the sender-aware window-controls bridge, so
 * each of those windows behaves like a real, standalone window.
 */
export function WindowButtons({
  fullscreen = false,
  height = 32,
  onClose
}: WindowButtonsProps): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    void window.windowControls.isMaximized().then(setMaximized)
    return window.windowControls.onMaximizedChanged(setMaximized)
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    void window.windowControls.isFullscreen().then(setIsFull)
    return window.windowControls.onFullscreenChanged(setIsFull)
  }, [fullscreen])

  return (
    <div className="app-no-drag flex" onPointerDown={(e) => e.stopPropagation()}>
      <Btn label="Minimize" height={height} onClick={() => window.windowControls.minimize()}>
        <Glyph>
          <line x1="5" y1="12" x2="19" y2="12" />
        </Glyph>
      </Btn>
      {fullscreen && (
        <Btn
          label={isFull ? 'Exit fullscreen' : 'Fullscreen'}
          height={height}
          onClick={() => window.windowControls.toggleFullscreen()}
        >
          {isFull ? <FullscreenExitIcon size={15} /> : <FullscreenIcon size={15} />}
        </Btn>
      )}
      <Btn
        label={maximized ? 'Restore' : 'Maximize'}
        height={height}
        onClick={() => window.windowControls.toggleMaximize()}
      >
        <Glyph>
          {maximized ? (
            <>
              <rect x="7" y="7" width="9" height="9" rx="1" />
              <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4H18a1.5 1.5 0 0 1 1.5 1.5V13A1.5 1.5 0 0 1 18 14.5h-1.5" />
            </>
          ) : (
            <rect x="6" y="6" width="12" height="12" rx="1" />
          )}
        </Glyph>
      </Btn>
      <Btn
        label="Close"
        danger
        height={height}
        onClick={onClose ?? (() => window.windowControls.close())}
      >
        <Glyph>
          <path d="M6 6l12 12M18 6L6 18" />
        </Glyph>
      </Btn>
    </div>
  )
}

function Glyph({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function Btn({
  label,
  children,
  onClick,
  height,
  danger = false
}: {
  label: string
  children: ReactNode
  onClick: () => void
  height: number
  danger?: boolean
}): JSX.Element {
  const hover = danger ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-surface-600'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ height, width: Math.round(height * 1.3) }}
      className={`flex items-center justify-center text-zinc-400 transition-colors ${hover}`}
    >
      {children}
    </button>
  )
}
