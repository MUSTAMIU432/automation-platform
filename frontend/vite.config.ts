import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Ship the app's own page as `404.html` too.
 *
 * Every route here (`/app`, `/auth`, `/app/messages/12`, ...) exists only in the
 * browser, so a static host asked for one directly - a refresh, a bookmark, a
 * link in an email - finds no file and answers "Not Found". A host that serves
 * `404.html` for a missing path then serves the app instead, and the router reads
 * the address and shows the right page. The host's own rewrite to `index.html`
 * is still the better answer (it says 200, not 404); this is the fallback for a
 * host where that rule is not set.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Fixed values so tests are deterministic and never depend on a
    // developer's frontend/.env (or the lack of one in CI).
    env: {
      VITE_GRAPHQL_URL: 'http://localhost:8000/graphql/',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/types/**', 'src/**/*.test.{ts,tsx}'],
    },
  },
})
