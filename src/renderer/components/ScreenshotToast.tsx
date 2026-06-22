import { useEffect, useState } from 'react'
import { usePlayerStore } from '../state/playerStore'
import { CameraIcon } from './icons'

/** Briefly confirms a saved screenshot, showing the written file name. */
export function ScreenshotToast(): JSX.Element | null {
  const lastScreenshot = usePlayerStore((s) => s.lastScreenshot)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!lastScreenshot) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [lastScreenshot])

  if (!visible || !lastScreenshot) return null
  const fileName = lastScreenshot.split(/[\\/]/).pop()

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-surface-700/95 px-3 py-2 text-sm text-zinc-100 shadow-xl ring-1 ring-surface-500 backdrop-blur">
      <CameraIcon size={16} className="text-accent" />
      <span>
        Saved <span className="font-mono text-zinc-300">{fileName}</span>
      </span>
    </div>
  )
}
