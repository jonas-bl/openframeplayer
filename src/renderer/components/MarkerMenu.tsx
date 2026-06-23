import { Popover } from './Popover'
import { BookmarkIcon } from './icons'
import { formatTimecode } from '../lib/format'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import { useMarkersStore } from '../state/markersStore'

/**
 * Timeline-marker (bookmark) control for the transport bar: drop a marker at the
 * playhead, jump to one, or remove it. Markers also render as ticks on the
 * SeekBar and persist per file. Gated to the `markers` feature (Standard+).
 */
export function MarkerMenu(): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const position = usePlayerStore((s) => selectPlayback(s).position)
  const markers = useMarkersStore((s) => s.markers)
  const add = useMarkersStore((s) => s.add)
  const removeAt = useMarkersStore((s) => s.removeAt)

  return (
    <Popover
      label="Markers (M)"
      align="right"
      panelClassName="w-56"
      trigger={() => (
        <span className="relative">
          <BookmarkIcon size={16} />
          {markers.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1 text-[9px] font-semibold leading-tight text-white">
              {markers.length}
            </span>
          )}
        </span>
      )}
    >
      {() => (
        <div className="text-sm">
          {markers.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-zinc-500">No markers yet.</p>
          )}
          {markers.map((m, index) => (
            <div
              key={`${m.time}:${index}`}
              className="group flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-200 hover:bg-surface-700"
            >
              <button
                type="button"
                onClick={() => dispatch({ type: 'seekAbsolute', seconds: m.time, precise: true })}
                className="min-w-0 flex-1 text-left font-mono text-xs tabular-nums"
              >
                {formatTimecode(m.time)}
              </button>
              <button
                type="button"
                aria-label="Remove marker"
                onClick={() => removeAt(index)}
                className="shrink-0 rounded p-0.5 text-zinc-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => add(position)}
            className="mt-0.5 w-full rounded-md px-2.5 py-1.5 text-left text-xs text-accent hover:bg-surface-700"
          >
            + Add marker here
          </button>
        </div>
      )}
    </Popover>
  )
}
