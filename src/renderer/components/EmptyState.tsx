import { useEffect, useState } from 'react'
import { usePlayerStore } from '../state/playerStore'
import { useUiStore } from '../state/uiStore'
import { PlayIcon } from './icons'
import type { RecentFile } from '@shared/fileMetadata'

/** "x minutes/hours/days ago" for a recent-file timestamp. */
function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

/** Idle screen shown when no media is loaded: open button + recent files. */
export function EmptyState(): JSX.Element {
  const openFile = usePlayerStore((s) => s.openFile)
  const dispatch = usePlayerStore((s) => s.dispatch)
  const requestIntro = useUiStore((s) => s.requestIntro)
  const [recents, setRecents] = useState<RecentFile[]>([])

  useEffect(() => {
    void window.api.getRecentFiles().then(setRecents)
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-700/80 ring-1 ring-surface-500 backdrop-blur">
        <PlayIcon size={32} className="ml-1 text-accent" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">FramePlayer</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          Frame-accurate video review. Open a file to begin.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => void openFile()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-accent-hover"
        >
          Open video…
        </button>
        <button
          onClick={requestIntro}
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Take a tour
        </button>
      </div>

      {recents.length > 0 && (
        <div className="w-72 text-left">
          <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Recent
          </div>
          <ul className="space-y-0.5">
            {recents.map((r) => (
              <li key={r.path}>
                <button
                  onClick={() => dispatch({ type: 'load', path: r.path })}
                  title={r.path}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-700/60"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                    {baseName(r.path)}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-500">{timeAgo(r.lastOpened)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
