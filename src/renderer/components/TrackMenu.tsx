import type { ReactNode } from 'react'
import { Popover } from './Popover'
import { SubtitlesIcon } from './icons'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import type { PlayerAction } from '@shared/player-actions'
import type { TrackInfo } from '@shared/player-state'

/** Human label for a track row: "<lang> · <title>" with sensible fallbacks. */
function trackLabel(t: TrackInfo): string {
  const parts = [t.lang?.toUpperCase(), t.title].filter(Boolean)
  const base = parts.length ? parts.join(' · ') : `Track ${t.id}`
  return t.external ? `${base} (external)` : base
}

/**
 * Subtitle + audio track picker for the transport bar. Lists the streams mpv
 * found in the file; subtitles also offer an "Off" row and a button to load an
 * external `.srt`/`.ass`. Gated to the `tracks` feature (visible in every mode).
 */
export function TrackMenu(): JSX.Element | null {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const { tracks, sid, aid } = usePlayerStore(selectPlayback)

  const subs = tracks.filter((t) => t.type === 'sub')
  const audio = tracks.filter((t) => t.type === 'audio')

  // Nothing to choose between — hide entirely (a lone audio track + no subs).
  if (subs.length === 0 && audio.length <= 1) return null

  return (
    <Popover
      label="Subtitles & audio tracks"
      align="right"
      panelClassName="w-60"
      trigger={() => <SubtitlesIcon size={16} />}
    >
      {(close) => (
        <div className="text-sm">
          <Section title="Subtitles">
            <Row
              label="Off"
              active={sid === null}
              onClick={() => {
                dispatch({ type: 'setTrack', track: 'sub', id: null })
                close()
              }}
            />
            {subs.map((t) => (
              <Row
                key={t.id}
                label={trackLabel(t)}
                active={sid === t.id}
                onClick={() => {
                  dispatch({ type: 'setTrack', track: 'sub', id: t.id })
                  close()
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                void openSubtitle(dispatch)
                close()
              }}
              className="mt-0.5 w-full rounded-md px-2.5 py-1.5 text-left text-xs text-accent hover:bg-surface-700"
            >
              + Add subtitle file…
            </button>
          </Section>

          {audio.length > 0 && (
            <Section title="Audio">
              {audio.map((t) => (
                <Row
                  key={t.id}
                  label={trackLabel(t)}
                  active={aid === t.id}
                  onClick={() => {
                    dispatch({ type: 'setTrack', track: 'audio', id: t.id })
                    close()
                  }}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </Popover>
  )
}

async function openSubtitle(dispatch: (a: PlayerAction) => void): Promise<void> {
  const path = await window.api.openFile()
  if (path) dispatch({ type: 'loadSubtitleFile', path })
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mb-1 last:mb-0">
      <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
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
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left ${
        active ? 'bg-accent/15 text-accent' : 'text-zinc-200 hover:bg-surface-700'
      }`}
    >
      <span className="truncate">{label}</span>
      {active && <span className="ml-2 shrink-0 text-accent">✓</span>}
    </button>
  )
}
