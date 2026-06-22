import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests target the pure, framework-free logic: the mpv command map, the
 * IPC framing/parsing, and binary/socket path resolution. These run in plain
 * Node with no Electron or mpv process required.
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
    include: ['src/**/*.test.ts'],
    // Integration tests spawn a real mpv process; run them via test:integration.
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    globals: true
  }
})
