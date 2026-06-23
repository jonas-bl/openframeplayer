import { useEffect, useState } from 'react'
import type { ExportStatus } from '@shared/ipc'
import { ExportIcon } from './icons'

const FORMAT_LABEL: Record<string, string> = { mp4: 'clip', gif: 'GIF', pngseq: 'frame sequence' }

/**
 * Bottom-centre toast tracking an export: a spinner while mpv encodes, then a
 * brief success (with the output name) or an error. Driven by the broadcast
 * {@link ExportStatus}, so it shows in whichever window is focused.
 */
export function ExportToast(): JSX.Element | null {
  const [status, setStatus] = useState<ExportStatus>({ phase: 'idle' })

  useEffect(() => window.api.onExportStatusChanged(setStatus), [])

  // Auto-dismiss the terminal states; keep the running spinner until it resolves.
  useEffect(() => {
    if (status.phase === 'done' || status.phase === 'error') {
      const timer = setTimeout(() => setStatus({ phase: 'idle' }), 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [status])

  if (status.phase === 'idle') return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-lg bg-surface-700/95 px-3 py-2 text-sm text-zinc-100 shadow-xl ring-1 ring-surface-500 backdrop-blur">
      {status.phase === 'running' && (
        <>
          <Spinner />
          <span>Exporting {FORMAT_LABEL[status.format] ?? 'clip'}…</span>
        </>
      )}
      {status.phase === 'done' && (
        <>
          <ExportIcon size={16} className="text-accent" />
          <span>
            Exported{' '}
            <span className="font-mono text-zinc-300">{status.outputPath.split(/[\\/]/).pop()}</span>
          </span>
        </>
      )}
      {status.phase === 'error' && <span className="text-red-300">Export failed: {status.message}</span>}
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
