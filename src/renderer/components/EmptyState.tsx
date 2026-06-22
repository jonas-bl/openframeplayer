import { usePlayerStore } from '../state/playerStore'
import { PlayIcon } from './icons'

/** Idle screen shown when no media is loaded. */
export function EmptyState(): JSX.Element {
  const openFile = usePlayerStore((s) => s.openFile)

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
      <button
        onClick={() => void openFile()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-accent-hover"
      >
        Open video…
      </button>
    </div>
  )
}
