import { useSettingsStore } from '../state/settingsStore'
import { isFeatureVisible, type Feature } from '@shared/featureVisibility'
import type { AppMode } from '@shared/settings'

/** The current UI mode (persisted setting, mirrored in the settings store). */
export function useMode(): AppMode {
  return useSettingsStore((s) => s.settings.mode)
}

/**
 * Convenience: is this feature visible in the current mode? In `custom` mode it
 * consults the user's per-feature switches; otherwise it uses the tier. Re-renders
 * on change.
 */
export function useFeatureVisible(feature: Feature): boolean {
  return useSettingsStore((s) => isFeatureVisible(feature, s.settings.mode, s.settings.customFeatures))
}
