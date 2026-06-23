import { usePlayerStore, selectVideo } from '../../state/playerStore'
import { Slider } from '../Slider'

/**
 * Image-correction panel (Pro dock): brightness + contrast grading of the live
 * frame, plus a reset. Zoom / flip / reset still live inline in the transport
 * bar — these colour adjustments are a pro-grading concern, so they sit beside
 * the scopes in the analysis dock.
 */
export function AdjustPanel(): JSX.Element {
  const dispatch = usePlayerStore((s) => s.dispatch)
  const video = usePlayerStore(selectVideo)

  return (
    <div className="space-y-3 text-sm">
      <Row
        label="Brightness"
        value={video.brightness}
        onChange={(value) => dispatch({ type: 'setBrightness', value })}
      />
      <Row
        label="Contrast"
        value={video.contrast}
        onChange={(value) => dispatch({ type: 'setContrast', value })}
      />
      <button
        type="button"
        onClick={() => dispatch({ type: 'resetImage' })}
        className="w-full rounded-md border border-surface-600 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-accent/60"
      >
        Reset corrections
      </button>
    </div>
  )
}

/** A stacked labelled slider sized for the narrow dock. */
function Row({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="font-mono text-xs tabular-nums text-zinc-300">{value}</span>
      </div>
      <Slider label={label} min={-100} max={100} value={value} onChange={onChange} className="w-full" />
    </div>
  )
}
