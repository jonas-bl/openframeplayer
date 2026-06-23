import { useState } from 'react'
import { usePlayerStore, selectPlayback } from '../state/playerStore'

/**
 * Jump-to-frame input for the transport bar (Pro). Type a frame number and press
 * Enter to land on it exactly. Shows the current frame as the placeholder; needs
 * a known fps (hidden otherwise). Analysts think in frames, not seconds.
 */
export function GoToFrame(): JSX.Element | null {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const { position, duration, frameCount, fps } = usePlayerStore(selectPlayback)
  const [value, setValue] = useState('')

  if (fps <= 0) return null

  const currentFrame = Math.round(position * fps)
  const totalFrames = frameCount > 0 ? frameCount : Math.round(duration * fps)

  const go = (): void => {
    const frame = Number.parseInt(value, 10)
    if (!Number.isFinite(frame)) return
    const clamped = Math.max(0, totalFrames > 0 ? Math.min(frame, totalFrames) : frame)
    dispatch({ type: 'seekAbsolute', seconds: clamped / fps, precise: true })
    setValue('')
  }

  return (
    <div className="flex items-center gap-1 font-mono text-xs text-zinc-400" title="Go to frame">
      <span className="text-zinc-500">#</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go()
          e.stopPropagation() // don't let digits trigger global shortcuts
        }}
        placeholder={String(currentFrame)}
        inputMode="numeric"
        className="w-16 rounded border border-surface-600 bg-surface-900 px-1.5 py-1 text-center tabular-nums text-zinc-200 placeholder:text-zinc-600 focus:border-accent/60 focus:outline-none"
      />
    </div>
  )
}
