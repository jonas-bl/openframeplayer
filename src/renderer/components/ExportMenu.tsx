import { useState } from 'react'
import { Popover } from './Popover'
import { ExportIcon } from './icons'
import { formatTimecode } from '../lib/format'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import { useFeatureVisible } from '../hooks/useMode'
import type { ExportFormat } from '@shared/ipc'

/**
 * Export the current clip as an MP4 / GIF (Standard) or a PNG frame sequence
 * (Pro). The range defaults to the active A-B loop when one is set, else the
 * whole file. Picking a format prompts for a destination and runs mpv headless
 * in the main process; progress shows in the export toast.
 */
export function ExportMenu(): JSX.Element | null {
  const { loopStart, loopEnd, duration } = usePlayerStore(selectPlayback)
  const showFrameSeq = useFeatureVisible('frameExport')

  const hasLoop = loopStart !== null && loopEnd !== null && loopEnd > loopStart
  const [useLoop, setUseLoop] = useState(true)
  const fromLoop = hasLoop && useLoop
  const start = fromLoop ? (loopStart as number) : 0
  const end = fromLoop ? (loopEnd as number) : duration

  const ready = end > start

  const run = (format: ExportFormat, close: () => void): void => {
    if (!ready) return
    void window.api.exportRange({ startSeconds: start, endSeconds: end, format })
    close()
  }

  return (
    <Popover
      label="Export clip"
      align="right"
      panelClassName="w-60"
      trigger={() => <ExportIcon size={16} />}
    >
      {(close) => (
        <div className="space-y-2 p-1 text-sm">
          {hasLoop && (
            <div className="flex gap-1">
              <RangeTab label="A–B loop" active={useLoop} onClick={() => setUseLoop(true)} />
              <RangeTab label="Whole file" active={!useLoop} onClick={() => setUseLoop(false)} />
            </div>
          )}

          <p className="px-1 font-mono text-xs tabular-nums text-zinc-400">
            {formatTimecode(start)} – {formatTimecode(end)}
            <span className="ml-1 text-zinc-600">({formatTimecode(Math.max(0, end - start))})</span>
          </p>

          <div className="space-y-1">
            <FormatButton label="Clip (MP4)" onClick={() => run('mp4', close)} disabled={!ready} />
            <FormatButton label="Animated GIF" onClick={() => run('gif', close)} disabled={!ready} />
            {showFrameSeq && (
              <FormatButton
                label="PNG frame sequence"
                onClick={() => run('pngseq', close)}
                disabled={!ready}
              />
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}

function RangeTab({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 text-xs ${
        active ? 'bg-accent/20 text-accent ring-1 ring-accent/40' : 'text-zinc-400 hover:bg-surface-700'
      }`}
    >
      {label}
    </button>
  )
}

function FormatButton({
  label,
  onClick,
  disabled
}: {
  label: string
  onClick: () => void
  disabled: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-surface-700 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  )
}
