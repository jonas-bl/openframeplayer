import { create } from 'zustand'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings'
import type { AppCommand } from '@shared/commands'
import type { AnalysisSettings, PanelId } from '@shared/panels'
import type { Feature } from '@shared/featureVisibility'

/**
 * Renderer mirror of persisted {@link AppSettings}. The main process is
 * authoritative; the keybinding mutators write through the bridge and the
 * change comes back via the settings-changed broadcast.
 *
 * Each command holds a list of bindings (any one triggers it); these helpers
 * append and remove individual bindings while leaving the rest untouched.
 */
interface SettingsStore {
  settings: AppSettings
  /** True once the authoritative settings have arrived from the main process. */
  loaded: boolean
  applySettings: (settings: AppSettings) => void
  /** Persist whether the first-run feature tour has been shown. */
  setHasSeenIntro: (seen: boolean) => void
  addKeybinding: (command: AppCommand, binding: string) => void
  removeKeybinding: (command: AppCommand, binding: string) => void
  /** Merge a patch into the persisted analysis (panel) settings. */
  updateAnalysis: (patch: Partial<AnalysisSettings>) => void
  /** Show or hide an analysis panel in the dock. */
  togglePanel: (id: PanelId) => void
  /** Flip a single feature's visibility switch (used by custom mode). */
  toggleFeature: (feature: Feature) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  applySettings: (settings) => set({ settings, loaded: true }),
  setHasSeenIntro: (seen) => {
    if (get().settings.hasSeenIntro === seen) return
    void window.api.updateSettings({ hasSeenIntro: seen })
  },
  addKeybinding: (command, binding) => {
    const current = get().settings.keybindings[command] ?? []
    if (current.includes(binding)) return
    const keybindings = { ...get().settings.keybindings, [command]: [...current, binding] }
    void window.api.updateSettings({ keybindings })
  },
  removeKeybinding: (command, binding) => {
    const current = get().settings.keybindings[command] ?? []
    const keybindings = {
      ...get().settings.keybindings,
      [command]: current.filter((b) => b !== binding)
    }
    void window.api.updateSettings({ keybindings })
  },

  updateAnalysis: (patch) => {
    const analysis = { ...get().settings.analysis, ...patch }
    void window.api.updateSettings({ analysis })
  },

  togglePanel: (id) => {
    const open = get().settings.analysis.openPanels
    const next = open.includes(id) ? open.filter((p) => p !== id) : [...open, id]
    void window.api.updateSettings({ analysis: { ...get().settings.analysis, openPanels: next } })
  },

  toggleFeature: (feature) => {
    const current = get().settings.customFeatures
    void window.api.updateSettings({
      customFeatures: { ...current, [feature]: !current[feature] }
    })
  }
}))
