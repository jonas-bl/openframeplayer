import { useEffect, useState } from 'react'
import {
  APP_COMMANDS,
  COMMAND_META,
  DEFAULT_KEYBINDINGS,
  findBindingConflicts,
  formatBinding,
  makeBinding,
  WHEEL_DOWN,
  WHEEL_UP,
  type AppCommand,
  type CommandGroup
} from '@shared/commands'
import { APP_MODES, TRACKING_ENGINES, type AppMode, type TrackingEngine } from '@shared/settings'
import { FEATURES, FEATURE_LABELS } from '@shared/featureVisibility'
import type { UpdateStatus } from '@shared/update'
import { IMAGE_PROVIDERS, IMAGE_PROVIDER_IDS, type ImageProviderId } from '@shared/imageGen'
import {
  UPSCALE_MODELS,
  UPSCALE_MODEL_IDS,
  type UpscaleModelId,
  type UpscaleModelStatus
} from '@shared/upscale'
import { chordModifier } from '../hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'

/** Left-nav sections: a "General" page plus one page per command group. */
type Section = 'General' | CommandGroup

const SECTIONS: Section[] = ['General', 'Playback', 'View', 'Image', 'Tools', 'App']

const SECTION_LABELS: Record<Section, string> = {
  General: 'General',
  Playback: 'Playback',
  View: 'View & zoom',
  Image: 'Image',
  Tools: 'Tools',
  App: 'Application'
}

const SECTION_ICONS: Record<Section, JSX.Element> = {
  General: (
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.5-2.6 1.6 1.6 0 010-3.2 1.6 1.6 0 001.5-2.6l-.1-.1A2 2 0 117.7 2.6l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.3 1.8 1.6 1.6 0 011.4 1.4 1.6 1.6 0 01-1.3 1.7z" />
  ),
  Playback: <path d="M8 5l11 7-11 7V5z" />,
  View: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  Image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M21 16l-5-5L5 20" />
    </>
  ),
  Tools: <path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 015.4-5.4l-2.5 2.5-1.5-1.5 2.5-2.5z" />,
  App: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M8 21h8" />
    </>
  )
}

const ENGINE_LABELS: Record<TrackingEngine, string> = {
  builtin: 'Built-in — fast, lightweight (default)',
  opencv: 'OpenCV CSRT — robust region tracker',
  ml: 'ML detector — GPU (experimental)'
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

/**
 * Settings popup. A left sidebar switches between a General page and one page
 * per command group; keybinding pages list each command with its (possibly
 * several) bindings — add one by capturing a key/wheel, remove with the × chip.
 * Persists through the settings bridge.
 */
export function SettingsModal(): JSX.Element {
  const close = useUiStore((s) => s.closeSettings)
  const [section, setSection] = useState<Section>('General')
  const [capturing, setCapturing] = useState<AppCommand | null>(null)
  const addKeybinding = useSettingsStore((s) => s.addKeybinding)
  const keybindings = useSettingsStore((s) => s.settings.keybindings)
  // Surfaced when a just-captured key already triggers other commands.
  const [warning, setWarning] = useState<BindingWarning | null>(null)

  // While capturing, intercept the next key or wheel notch (in the capture
  // phase, so the global handlers never see it) and add it as a new binding —
  // holding Ctrl/Alt records a modifier, so e.g. Ctrl+scroll becomes a chord.
  useEffect(() => {
    if (!capturing) return
    // Add the binding, but first flag any other commands it already triggers
    // (the binding is still kept — the warning just tells the user what clashes).
    const commit = (binding: string): void => {
      const conflicts = findBindingConflicts(keybindings, binding, capturing)
      setWarning(conflicts.length ? { command: capturing, binding, conflicts } : null)
      addKeybinding(capturing, binding)
      setCapturing(null)
    }
    const onKey = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') return setCapturing(null)
      if (MODIFIER_KEYS.has(event.key)) return // wait for the non-modifier key
      commit(makeBinding(chordModifier(event), event.key))
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      event.stopImmediatePropagation()
      const key = event.deltaY < 0 ? WHEEL_UP : WHEEL_DOWN
      commit(makeBinding(chordModifier(event), key))
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', onWheel, true)
    }
  }, [capturing, addKeybinding, keybindings])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={close}
    >
      <div
        className="flex h-[80%] max-h-[40rem] w-[48rem] max-w-[92%] overflow-hidden rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <nav className="flex w-44 shrink-0 flex-col border-r border-surface-700 bg-surface-900/50">
          <div className="px-4 py-3.5 text-sm font-semibold text-zinc-100">Settings</div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSection(s)
                  setCapturing(null)
                  setWarning(null)
                }}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                  section === s
                    ? 'bg-accent/20 text-accent'
                    : 'text-zinc-300 hover:bg-surface-700/60 hover:text-zinc-100'
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  {SECTION_ICONS[s]}
                </svg>
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            onClick={() => void window.api.updateSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } })}
            className="m-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-400 hover:bg-surface-700/60 hover:text-zinc-200"
          >
            Reset shortcuts to defaults
          </button>
        </nav>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-surface-700 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-zinc-100">{SECTION_LABELS[section]}</h2>
            <button
              onClick={close}
              aria-label="Close"
              className="rounded p-1 text-zinc-400 hover:bg-surface-600 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
            {section === 'General' ? (
              <GeneralSection />
            ) : (
              <KeybindingSection
                group={section}
                capturing={capturing}
                onCapture={(command) => {
                  setWarning(null)
                  setCapturing(command)
                }}
                warning={warning}
                onDismissWarning={() => setWarning(null)}
              />
            )}
          </div>

          <footer className="flex items-center justify-end border-t border-surface-700 px-5 py-3">
            <button
              onClick={close}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Done
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

/** General (non-keybinding) settings: screenshots, panels, motion tracking. */
function GeneralSection(): JSX.Element {
  const screenshotDir = useSettingsStore((s) => s.settings.screenshotDir)
  const trackingEngine = useSettingsStore((s) => s.settings.trackingEngine)

  const chooseFolder = async (): Promise<void> => {
    const dir = await window.api.chooseDirectory()
    if (dir) void window.api.updateSettings({ screenshotDir: dir })
  }

  return (
    <div className="space-y-6">
      <ModeSection />

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Screenshots</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5 font-mono text-xs text-zinc-300">
            {screenshotDir || 'Pictures\\FramePlayer (default)'}
          </div>
          <button
            onClick={() => void chooseFolder()}
            className="rounded-md border border-surface-600 px-2 py-1.5 text-xs text-zinc-200 hover:border-accent/60"
          >
            Browse…
          </button>
          {screenshotDir && (
            <button
              onClick={() => void window.api.updateSettings({ screenshotDir: '' })}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Default
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Motion tracking
        </h3>
        <select
          value={trackingEngine}
          onChange={(e) =>
            void window.api.updateSettings({ trackingEngine: e.target.value as TrackingEngine })
          }
          className="w-full rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-accent/60 focus:outline-none"
        >
          {TRACKING_ENGINES.map((engine) => (
            <option key={engine} value={engine}>
              {ENGINE_LABELS[engine]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          Engine for motion-follow drawings and keep-centred autofocus. ML falls back to the
          built-in tracker if its model isn&apos;t installed.
        </p>
      </section>

      <UpscaleSection />

      <AiImageSection />

      <UpdatesSection />
    </div>
  )
}

const MODE_INFO: Record<AppMode, { label: string; blurb: string }> = {
  casual: {
    label: 'Casual',
    blurb: 'Just the essentials: play, seek, volume, speed, subtitles & playlist.'
  },
  standard: {
    label: 'Standard',
    blurb: 'The full everyday player — frame stepping, loops, zoom, annotations & markers.'
  },
  pro: {
    label: 'Pro',
    blurb: 'Everything, plus the analysis tools: measurement, scopes, frame-diff, comparison & export.'
  },
  custom: {
    label: 'Custom',
    blurb: 'Pick exactly which controls appear — toggle any feature on or off below.'
  }
}

/**
 * Interface-mode picker. Modes gate *visibility only* — every action stays
 * reachable via its keybinding regardless of mode — so this just tunes how much
 * of the control surface is shown by default.
 */
function ModeSection(): JSX.Element {
  const mode = useSettingsStore((s) => s.settings.mode)

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Interface mode</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {APP_MODES.map((m) => (
          <button
            key={m}
            onClick={() => void window.api.updateSettings({ mode: m })}
            className={`rounded-lg border px-2.5 py-2 text-left ${
              mode === m
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-surface-600 text-zinc-300 hover:border-accent/60 hover:text-zinc-100'
            }`}
          >
            <span className="text-sm font-medium">{MODE_INFO[m].label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{MODE_INFO[mode].blurb}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
        Modes only change what&apos;s shown — every action stays available through its keyboard
        shortcut.
      </p>
      {mode === 'custom' && <CustomFeatures />}
    </section>
  )
}

/**
 * Custom-mode feature switches. Shown only when the mode is `custom`; each row
 * toggles one feature's visibility (persisted in `customFeatures`). Hidden
 * features stay reachable by their keyboard shortcut, like the tiered modes.
 */
function CustomFeatures(): JSX.Element {
  const customFeatures = useSettingsStore((s) => s.settings.customFeatures)
  const toggleFeature = useSettingsStore((s) => s.toggleFeature)

  return (
    <div className="mt-3 rounded-lg border border-surface-700 p-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {FEATURES.map((feature) => (
          <label
            key={feature}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-surface-700/60"
          >
            <span className="truncate">{FEATURE_LABELS[feature]}</span>
            <input
              type="checkbox"
              checked={customFeatures[feature]}
              onChange={() => toggleFeature(feature)}
              className="h-4 w-4 shrink-0 accent-accent"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

/** Maps an update status to a one-line description for the settings row. */
function describeUpdate(status: UpdateStatus): string {
  switch (status.state) {
    case 'checking':
      return 'Checking for updates…'
    case 'available':
      return `Update ${status.version} found — downloading…`
    case 'downloading':
      return `Downloading update… ${status.percent}%`
    case 'downloaded':
      return `Update ${status.version} ready to install.`
    case 'up-to-date':
      return 'You’re on the latest version.'
    case 'error':
      return `Update check failed: ${status.message}`
    default:
      return 'Updates install automatically in the background.'
  }
}

/**
 * App version + manual update check. Updates download on their own in the
 * background; this just lets the user check on demand and restart into a staged
 * update. In dev / unpackaged builds the check is a no-op (status stays idle).
 */
function UpdatesSection(): JSX.Element {
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => void window.api.getAppVersion().then(setVersion), [])
  useEffect(() => window.api.onUpdateStatusChanged(setStatus), [])

  const busy = status.state === 'checking' || status.state === 'downloading'

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Updates</h3>
      <div className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-900/50 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-200">
            FramePlayer{' '}
            {version && <span className="font-mono text-zinc-400">v{version}</span>}
          </div>
          <p className="truncate text-[11px] text-zinc-500">{describeUpdate(status)}</p>
        </div>
        {status.state === 'downloaded' ? (
          <button
            onClick={() => window.api.installUpdate()}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Restart to update
          </button>
        ) : (
          <button
            onClick={() => void window.api.checkForUpdates()}
            disabled={busy}
            className="shrink-0 rounded-md border border-surface-600 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
          >
            {status.state === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * Bring-your-own-key AI image generation. The user picks a provider and pastes
 * their own API key (kept locally in settings); the screenshot editor's Enhance
 * and Regenerate actions then call that provider with the user's key. Nothing is
 * billed to the app — the user pays their own usage.
 */
function AiImageSection(): JSX.Element {
  const provider = useSettingsStore((s) => s.settings.imageProvider)
  const apiKeys = useSettingsStore((s) => s.settings.imageApiKeys)
  const [reveal, setReveal] = useState(false)
  const def = IMAGE_PROVIDERS[provider]

  const setKey = (value: string): void => {
    void window.api.updateSettings({ imageApiKeys: { ...apiKeys, [provider]: value } })
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        AI image (bring your own key)
      </h3>

      <label className="mb-1 block text-[11px] text-zinc-400">Provider</label>
      <select
        value={provider}
        onChange={(e) =>
          void window.api.updateSettings({ imageProvider: e.target.value as ImageProviderId })
        }
        className="w-full rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-accent/60 focus:outline-none"
      >
        {IMAGE_PROVIDER_IDS.map((id) => (
          <option key={id} value={id}>
            {IMAGE_PROVIDERS[id].label}
          </option>
        ))}
      </select>

      <label className="mb-1 mt-3 block text-[11px] text-zinc-400">API key</label>
      <div className="flex items-center gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={apiKeys[provider] ?? ''}
          onChange={(e) => setKey(e.target.value)}
          placeholder={def.keyHint}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5 font-mono text-xs text-zinc-200 focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="shrink-0 rounded-md border border-surface-600 px-2 py-1.5 text-xs text-zinc-300 hover:border-accent/60"
        >
          {reveal ? 'Hide' : 'Show'}
        </button>
        {apiKeys[provider] && (
          <button
            type="button"
            onClick={() => setKey('')}
            className="shrink-0 text-xs text-zinc-400 hover:text-red-400"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        {def.note} Get a key at{' '}
        <span className="break-all font-mono text-zinc-400">{def.keyUrl}</span>. The key is stored
        locally on this machine and sent only to the provider you choose. Each Enhance / Regenerate
        is billed to your own account.
      </p>
    </section>
  )
}

const MB = (bytes: number): string => `${Math.round(bytes / 1_000_000)} MB`

/**
 * Upscaling settings: pick the default super-resolution model and manage the
 * on-demand model downloads. Nothing ships with the app — each model is fetched
 * the first time it's used (or here, explicitly) and cached under userData.
 */
function UpscaleSection(): JSX.Element {
  const upscaleModel = useSettingsStore((s) => s.settings.upscaleModel)
  const [status, setStatus] = useState<UpscaleModelStatus | null>(null)
  const [busy, setBusy] = useState<UpscaleModelId | null>(null)
  const [pct, setPct] = useState<number | null>(null)

  const refresh = (): void => void window.api.upscaleModelStatus().then(setStatus)
  useEffect(refresh, [])

  useEffect(() => {
    return window.api.onUpscaleProgress((p) => {
      if (p.id === busy) setPct(p.total ? p.received / p.total : null)
    })
  }, [busy])

  const download = async (id: UpscaleModelId): Promise<void> => {
    setBusy(id)
    setPct(null)
    try {
      await window.api.loadUpscaleModel(id)
    } finally {
      setBusy(null)
      setPct(null)
      refresh()
    }
  }

  const remove = async (id: UpscaleModelId): Promise<void> => {
    await window.api.removeUpscaleModel(id)
    refresh()
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Upscaling (super-resolution)
      </h3>
      <label className="mb-1 block text-[11px] text-zinc-400">Default model</label>
      <select
        value={upscaleModel}
        onChange={(e) =>
          void window.api.updateSettings({ upscaleModel: e.target.value as UpscaleModelId })
        }
        className="w-full rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-accent/60 focus:outline-none"
      >
        {UPSCALE_MODEL_IDS.map((id) => (
          <option key={id} value={id}>
            {UPSCALE_MODELS[id].label}
          </option>
        ))}
      </select>

      <div className="mt-3 space-y-1.5">
        {UPSCALE_MODEL_IDS.map((id) => {
          const def = UPSCALE_MODELS[id]
          const installed = status?.[id] ?? false
          const isBusy = busy === id
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-900/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200">{def.label}</span>
                  {installed && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      Installed
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-zinc-500">{def.description}</p>
              </div>
              {isBusy ? (
                <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                  {pct === null ? 'Downloading…' : `${Math.round(pct * 100)}%`}
                </span>
              ) : installed ? (
                <button
                  onClick={() => void remove(id)}
                  className="shrink-0 text-xs text-zinc-400 hover:text-red-400"
                >
                  Remove
                </button>
              ) : (
                <button
                  onClick={() => void download(id)}
                  disabled={busy !== null}
                  className="shrink-0 rounded-md border border-surface-600 px-2 py-1 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
                >
                  Download ({MB(def.approxBytes)})
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Models download on first use and are cached on disk, so the app install stays small. Use
        them from the screenshot editor&apos;s <span className="text-zinc-400">Upscale</span> button.
      </p>
    </section>
  )
}

/** A just-captured binding that also triggers `conflicts` (other commands). */
interface BindingWarning {
  command: AppCommand
  binding: string
  conflicts: AppCommand[]
}

/** Joins command labels into a readable list: "A", "A & B", "A, B & C". */
function listCommandLabels(commands: AppCommand[]): string {
  const labels = commands.map((c) => COMMAND_META[c].label)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`
}

interface KeybindingSectionProps {
  group: CommandGroup
  capturing: AppCommand | null
  onCapture: (command: AppCommand) => void
  warning: BindingWarning | null
  onDismissWarning: () => void
}

/** A list of commands in one group, each with its bindings + an Add button. */
function KeybindingSection({
  group,
  capturing,
  onCapture,
  warning,
  onDismissWarning
}: KeybindingSectionProps): JSX.Element {
  return (
    <div>
      <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">
        Each action can have several shortcuts — any of them triggers it. Click{' '}
        <span className="font-mono text-zinc-400">+ Add</span>, then press a key or scroll the wheel.
        Hold <span className="font-mono text-zinc-400">Ctrl</span> or{' '}
        <span className="font-mono text-zinc-400">Alt</span> to add a modifier (e.g. Ctrl + scroll).
      </p>
      {warning && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-amber-100">{formatBinding(warning.binding)}</span> is also
            bound to <span className="font-medium">{listCommandLabels(warning.conflicts)}</span>. Both
            will fire when you press it.
          </div>
          <button
            onClick={onDismissWarning}
            aria-label="Dismiss warning"
            className="rounded p-0.5 text-amber-300/70 hover:bg-amber-500/20 hover:text-amber-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      <div className="space-y-1">
        {APP_COMMANDS.filter((c) => COMMAND_META[c].group === group).map((command) => (
          <KeybindingRow
            key={command}
            command={command}
            capturing={capturing === command}
            onCapture={() => onCapture(command)}
          />
        ))}
      </div>
    </div>
  )
}

interface KeybindingRowProps {
  command: AppCommand
  capturing: boolean
  onCapture: () => void
}

/** One command's row: its label, removable binding chips, and an Add button. */
function KeybindingRow({ command, capturing, onCapture }: KeybindingRowProps): JSX.Element {
  const bindings = useSettingsStore((s) => s.settings.keybindings[command])
  const keybindings = useSettingsStore((s) => s.settings.keybindings)
  const removeKeybinding = useSettingsStore((s) => s.removeKeybinding)

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-700/60">
      <span className="shrink-0 text-sm text-zinc-200">{COMMAND_META[command].label}</span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {bindings.map((binding) => {
          // Other commands this same key already triggers — flag the clash so
          // it's visible at a glance, not just at the moment of binding.
          const conflicts = findBindingConflicts(keybindings, binding, command)
          const conflictHint =
            conflicts.length > 0 ? `Also bound to ${listCommandLabels(conflicts)}` : undefined
          return (
            <span
              key={binding}
              title={conflictHint}
              className={`group flex items-center gap-1 rounded-md border py-1 pl-2 pr-1 font-mono text-xs ${
                conflicts.length > 0
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-surface-600 bg-surface-900 text-zinc-300'
              }`}
            >
              {conflicts.length > 0 && (
                <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400" aria-label="Conflicting shortcut">
                  <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              )}
              {formatBinding(binding)}
              <button
                onClick={() => removeKeybinding(command, binding)}
                aria-label={`Remove ${formatBinding(binding)}`}
                className="rounded p-0.5 text-zinc-500 hover:bg-surface-600 hover:text-red-400"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          )
        })}
        {bindings.length === 0 && !capturing && (
          <span className="text-xs italic text-zinc-600">Unbound</span>
        )}
        <button
          onClick={onCapture}
          className={`rounded-md border px-2 py-1 text-xs ${
            capturing
              ? 'animate-pulse border-accent bg-accent/20 text-accent'
              : 'border-dashed border-surface-500 text-zinc-400 hover:border-accent/60 hover:text-zinc-200'
          }`}
        >
          {capturing ? 'Press a key…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}
