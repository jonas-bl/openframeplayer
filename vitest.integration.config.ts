import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Integration tests: these spawn the real bundled mpv and talk to it over IPC.
 * Run with `npm run test:integration`. They auto-skip if mpv is not present
 * (run `npm run fetch:mpv` first).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globals: true,
    testTimeout: 20000
  }
})
