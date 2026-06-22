import { join } from 'node:path'

/** Absolute path to the bundled preload script (electron-vite emits out/preload). */
export const PRELOAD_PATH = join(__dirname, '../preload/index.js')

/** Renderer entry: dev server URL or the built HTML file. */
export function rendererTarget(view?: string): { url?: string; file?: string; search?: string } {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  const search = view ? `view=${view}` : undefined
  if (devServerUrl) {
    return { url: view ? `${devServerUrl}?${search}` : devServerUrl }
  }
  return { file: join(__dirname, '../renderer/index.html'), search }
}
