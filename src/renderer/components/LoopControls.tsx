import type { SmoothLoopStatus } from '@shared/player-state'
import { IconButton } from './IconButton'
import { LoopIcon, ReverseIcon } from './icons'
import { usePlayerStore, selectPlayback } from '../state/playerStore'
import { useCommands } from '../commands/useCommands'
import { formatTimecode } from '../lib/format'

/**
 * Loop controls: whole-file loop, A-B segment loop, and reverse playback.
 *
 * The loop button toggles infinite replay of the whole file (and acts as a
 * "stop looping" when a segment loop is active). The A / B buttons mark the
 * in/out points of a segment loop at the current frame; mpv then loops that
 * range natively. The reverse button is a persistent **play-direction** toggle:
 * when backward, the play button runs the video in reverse (and flips live if
 * pressed while already playing).
 */
export function LoopControls(): JSX.Element {
  const playback = usePlayerStore(selectPlayback)
  const run = useCommands()
  const { loopMode, loopStart, loopEnd, loopReverse, smoothLoop } = playback

  const looping = loopMode !== 'off'
  // A-B marks define a selection that persists independently of whether looping
  // is currently on, so reflect them whenever they're set.
  const aSet = loopStart !== null
  const bSet = loopEnd !== null
  const hasSelection = aSet || bSet
  const loopLabel = looping
    ? 'Stop looping (L)'
    : hasSelection
      ? 'Loop selection (L)'
      : 'Loop whole video (L)'

  return (
    <div className="flex items-center gap-0.5">
      <SmoothLoopBadge status={smoothLoop} />
      <IconButton label={loopLabel} size="sm" active={looping} onClick={() => run('toggleLoop')}>
        <LoopIcon size={16} />
      </IconButton>
      <IconButton
        label={
          loopStart !== null ? `Loop start ${formatTimecode(loopStart)} — reset ([)` : 'Set loop start ([)'
        }
        size="sm"
        active={aSet}
        onClick={() => run('setLoopStart')}
      >
        <span className="text-xs font-semibold">A</span>
      </IconButton>
      <IconButton
        label={
          loopEnd !== null ? `Loop end ${formatTimecode(loopEnd)} — reset (])` : 'Set loop end (])'
        }
        size="sm"
        active={bSet}
        onClick={() => run('setLoopEnd')}
      >
        <span className="text-xs font-semibold">B</span>
      </IconButton>
      {hasSelection && (
        <IconButton label="Clear A-B selection" size="sm" onClick={() => run('clearLoop')}>
          <span className="text-xs font-semibold">✕</span>
        </IconButton>
      )}
      <IconButton
        label={
          loopReverse
            ? 'Play direction: backward — play runs in reverse (Alt+L)'
            : 'Play direction: forward — set reverse (Alt+L)'
        }
        size="sm"
        active={loopReverse}
        onClick={() => run('toggleLoopReverse')}
      >
        <ReverseIcon size={16} />
      </IconButton>
    </div>
  )
}

/**
 * Tiny status pill for the smooth-loop proxy: a spinner-ish "preparing" while
 * the loop segment transcodes, then a steady "smooth" once the proxy is live.
 * Hidden entirely when no proxy is involved, so a plain loop looks unchanged.
 */
function SmoothLoopBadge({ status }: { status: SmoothLoopStatus }): JSX.Element | null {
  if (status === 'off') return null
  const preparing = status === 'preparing'
  return (
    <span
      title={
        preparing
          ? 'Preparing a smooth-loop proxy of the A-B range…'
          : 'Smooth loop active — looping and reverse play from an all-intra proxy'
      }
      className={`mr-1 select-none rounded px-1 text-[10px] font-semibold uppercase tracking-wide ${
        preparing ? 'animate-pulse bg-surface-600 text-zinc-300' : 'bg-accent/20 text-accent'
      }`}
    >
      {preparing ? '⋯ prep' : '✨ smooth'}
    </span>
  )
}
