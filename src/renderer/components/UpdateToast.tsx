import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/update'

/**
 * Unobtrusive auto-update notice in the bottom-right corner.
 *
 * Stays silent for the quiet phases (idle / checking / up-to-date) — the only
 * things worth interrupting for are a download in progress and, more
 * importantly, an update that's staged and ready. "Later" dismisses the prompt
 * (the update still installs on the next quit); it reappears if a newer phase
 * arrives.
 */
export function UpdateToast(): JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => window.api.onUpdateStatusChanged(setStatus), [])
  // A new phase (e.g. download finished) clears a previous dismissal.
  useEffect(() => setDismissed(false), [status.state])

  if (dismissed) return null

  if (status.state === 'downloading') {
    return (
      <Shell>
        <Spinner />
        <span>
          Downloading update… <span className="font-mono text-zinc-300">{status.percent}%</span>
        </span>
      </Shell>
    )
  }

  if (status.state === 'downloaded') {
    return (
      <Shell>
        <span>
          Update <span className="font-mono text-zinc-300">{status.version}</span> ready
        </span>
        <button
          onClick={() => window.api.installUpdate()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
        >
          Restart now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          Later
        </button>
      </Shell>
    )
  }

  return null
}

/** Shared toast chrome: bottom-right, above the video, interactive. */
function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-lg bg-surface-700/95 px-3 py-2 text-sm text-zinc-100 shadow-xl ring-1 ring-surface-500 backdrop-blur">
      {children}
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin text-accent" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
