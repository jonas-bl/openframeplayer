import { useSettingsStore } from '../../state/settingsStore'
import { Slider } from '../Slider'

/**
 * Controls for the onion-skin / frame-difference overlay: pin the current frame
 * as a reference, then compare it against the live frame as a ghost or a
 * difference blend. "Pin" bumps a sequence the main window watches to capture
 * the frame (works even when this panel is in the detached window).
 */
export function FrameDiffPanel(): JSX.Element {
  const fd = useSettingsStore((s) => s.settings.analysis.frameDiff)
  const updateAnalysis = useSettingsStore((s) => s.updateAnalysis)

  const pin = (): void =>
    updateAnalysis({ frameDiff: { ...fd, active: true, pinSeq: fd.pinSeq + 1 } })
  const clear = (): void => updateAnalysis({ frameDiff: { ...fd, active: false } })

  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={pin}
          className="flex-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        >
          {fd.active ? 'Re-pin reference' : 'Pin reference'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!fd.active}
          className="rounded-md border border-surface-600 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div>
        <div className="mb-1 flex gap-1">
          {(['ghost', 'difference'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => updateAnalysis({ frameDiff: { ...fd, mode: m } })}
              className={`flex-1 rounded-md px-2 py-1 text-xs capitalize ${
                fd.mode === m
                  ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                  : 'text-zinc-400 hover:bg-surface-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {fd.mode === 'ghost' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Opacity</span>
          <Slider
            label="Reference opacity"
            min={0}
            max={100}
            value={Math.round(fd.opacity * 100)}
            onChange={(v) => updateAnalysis({ frameDiff: { ...fd, opacity: v / 100 } })}
            className="flex-1"
          />
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Pin a frame, then step or seek — the pinned frame stays overlaid so you can see exactly
        what moved.
      </p>
    </div>
  )
}
