import { IconButton } from './IconButton'
import { LinkIcon } from './icons'
import { useUiStore } from '../state/uiStore'

/**
 * Transport-link toggle for window comparison (Pro). When on, this window's
 * play/pause, seek, frame-step and speed mirror to — and from — every other
 * linked window, so two videos opened side by side scrub in lock-step. Open a
 * second window (N), load the other clip, and link both.
 */
export function ComparisonLink(): JSX.Element {
  const linked = useUiStore((s) => s.comparisonLinked)

  return (
    <IconButton
      label={linked ? 'Transport linked — click to unlink' : 'Link transport across windows'}
      size="sm"
      active={linked}
      onClick={() => window.api.setComparisonLink(!linked)}
    >
      <LinkIcon size={16} />
    </IconButton>
  )
}
