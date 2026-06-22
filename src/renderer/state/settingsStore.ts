import { create } from 'zustand'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings'
import type { AppCommand } from '@shared/commands'

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
  applySettings: (settings: AppSettings) => void
  addKeybinding: (command: AppCommand, binding: string) => void
  removeKeybinding: (command: AppCommand, binding: string) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  applySettings: (settings) => set({ settings }),
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
  }
}))
