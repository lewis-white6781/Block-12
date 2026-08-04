import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// A short, stable identifier for exactly which build is running — SPEC-V3.0.md
// section 5. Surfaced in Settings' About card so "is my phone on the new
// version?" is answerable from the device rather than inferred.
//
// Git sha when available, falling back to a timestamp so a build from a
// tarball or a CI checkout without git history still succeeds rather than
// failing the whole build over a cosmetic string.
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  test: {
    environment: 'jsdom',
  },
})
