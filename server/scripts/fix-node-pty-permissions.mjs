// npm/pnpm tarball extraction sometimes drops the executable bit on
// node-pty's bundled spawn-helper binaries (a known packaging quirk, not a
// node-pty bug per se) - without +x, every terminal_start fails at the OS
// level with "posix_spawnp failed" and crashes the whole server process.
// Runs as a postinstall step so this never has to be diagnosed by hand
// again.
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const prebuildsDir = path.resolve(here, '../../node_modules/.pnpm')

let fixed = 0
try {
  for (const entry of readdirSync(prebuildsDir)) {
    if (!entry.startsWith('node-pty@')) continue
    const base = path.join(prebuildsDir, entry, 'node_modules/node-pty/prebuilds')
    if (!existsSync(base)) continue
    for (const platform of readdirSync(base)) {
      const helper = path.join(base, platform, 'spawn-helper')
      if (existsSync(helper)) {
        chmodSync(helper, 0o755)
        fixed += 1
      }
    }
  }
} catch {
  // Non-macOS/Linux platforms (e.g. the Windows conpty backend) have no
  // spawn-helper binary to fix - nothing to do there.
}

if (fixed > 0) console.log(`[postinstall] fixed executable permission on ${fixed} node-pty spawn-helper binary(ies)`)
