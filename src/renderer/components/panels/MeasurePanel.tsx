import { useSettingsStore } from '../../state/settingsStore'
import type { GuideSettings } from '@shared/panels'

const GUIDES: { key: keyof GuideSettings; label: string }[] = [
  { key: 'thirds', label: 'Rule of thirds' },
  { key: 'grid', label: 'Grid' },
  { key: 'center', label: 'Centre cross' },
  { key: 'safe', label: 'Safe margins' }
]

/** Toggles for the composition / measurement guide overlays. */
export function MeasurePanel(): JSX.Element {
  const guides = useSettingsStore((s) => s.settings.analysis.guides)
  const updateAnalysis = useSettingsStore((s) => s.updateAnalysis)

  return (
    <div className="space-y-1">
      {GUIDES.map(({ key, label }) => (
        <label
          key={key}
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-surface-700/60"
        >
          <span>{label}</span>
          <input
            type="checkbox"
            checked={guides[key]}
            onChange={(e) => updateAnalysis({ guides: { ...guides, [key]: e.target.checked } })}
            className="h-4 w-4 accent-accent"
          />
        </label>
      ))}
    </div>
  )
}
