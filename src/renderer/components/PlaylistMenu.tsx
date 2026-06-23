import { Popover } from './Popover'
import { PlaylistIcon } from './icons'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import type { PlaylistEntry } from '@shared/player-state'

/** The file name shown for a playlist row (title if present, else basename). */
function entryLabel(e: PlaylistEntry): string {
  if (e.title) return e.title
  const parts = e.filename.split(/[\\/]/)
  return parts[parts.length - 1] || e.filename
}

/**
 * Playlist / queue control for the transport bar: lists the queued files, plays
 * one on click, removes with the × chip, and appends more with "Add files…".
 * mpv auto-advances through the queue. Gated to the `playlist` feature.
 */
export function PlaylistMenu(): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const addToPlaylist = usePlayerStore((s) => s.addToPlaylist)
  const { playlist, playlistPos } = usePlayerStore(selectPlayback)

  return (
    <Popover
      label="Playlist"
      align="right"
      panelClassName="w-72"
      trigger={() => (
        <span className="relative">
          <PlaylistIcon size={16} />
          {playlist.length > 1 && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1 text-[9px] font-semibold leading-tight text-white">
              {playlist.length}
            </span>
          )}
        </span>
      )}
    >
      {() => (
        <div className="text-sm">
          {playlist.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-zinc-500">Queue is empty.</p>
          )}
          {playlist.map((entry, index) => {
            const current = index === playlistPos || entry.current
            return (
              <div
                key={`${entry.filename}:${index}`}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
                  current ? 'bg-accent/15 text-accent' : 'text-zinc-200 hover:bg-surface-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'playlistPlayIndex', index })}
                  className="min-w-0 flex-1 truncate text-left"
                  title={entry.filename}
                >
                  {current && <span className="mr-1">▶</span>}
                  {entryLabel(entry)}
                </button>
                <button
                  type="button"
                  aria-label="Remove from playlist"
                  onClick={() => dispatch({ type: 'playlistRemove', index })}
                  className="shrink-0 rounded p-0.5 text-zinc-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => void addToPlaylist()}
            className="mt-0.5 w-full rounded-md px-2.5 py-1.5 text-left text-xs text-accent hover:bg-surface-700"
          >
            + Add files…
          </button>
        </div>
      )}
    </Popover>
  )
}
