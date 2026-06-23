import { join } from 'node:path'

/** Absolute path to the bundled preload script (electron-vite emits out/preload). */
export const PRELOAD_PATH = join(__dirname, '../preload/index.js')

/**
 * Renderer entry: dev server URL or the built HTML file. `view` selects which
 * root the bundle mounts (controls / panels / editor); `extra` appends any other
 * query params (e.g. `launchedWithFile`) read by the renderer at startup.
 */
export function rendererTarget(
  view?: string,
  extra?: Record<string, string>
): { url?: string; file?: string; search?: string } {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  const params = new URLSearchParams()
  if (view) params.set('view', view)
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
  const search = params.toString() || undefined
  if (devServerUrl) {
    return { url: search ? `${devServerUrl}?${search}` : devServerUrl }
  }
  return { file: join(__dirname, '../renderer/index.html'), search }
}
