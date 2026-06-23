import { formatTimecode } from '../lib/format'

/**
 * Offers to resume playback at the saved position when a file reopens. Anchored
 * top-centre so it doesn't clash with the screenshot toast (bottom-centre).
 */
export function ResumeToast({
  seconds,
  onResume,
  onDismiss
}: {
  seconds: number
  onResume: () => void
  onDismiss: () => void
}): JSX.Element {
  return (
    <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-surface-700/95 px-3 py-2 text-sm text-zinc-100 shadow-xl ring-1 ring-surface-500 backdrop-blur">
      <span>
        Resume at <span className="font-mono text-zinc-300">{formatTimecode(seconds)}</span>?
      </span>
      <button
        type="button"
        onClick={onResume}
        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
      >
        Resume
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-zinc-400 hover:bg-surface-600 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
