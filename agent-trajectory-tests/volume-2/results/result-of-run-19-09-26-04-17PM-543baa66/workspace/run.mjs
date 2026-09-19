import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

const ctx = new Context()
const fibers = []

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

await ctx.plugin(WebServer, { host: '127.0.0.1', port: Number(process.env.PORT) || 8790 })

ctx.webServer.register({
  kind: 'exact',
  path: '/healthz',
  handler: (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
  },
})

const entries = await readdir(dir, { withFileTypes: true })
const pluginFiles = entries
  .filter((e) => e.isFile() && e.name.endsWith('.mjs') && e.name !== 'run.mjs')
  .map((e) => e.name)
  .sort()

if (pluginFiles.length === 0) {
  console.log('[run] no plugin files found (looked for *.mjs, excluding run.mjs)')
}

const mounted = []
for (const file of pluginFiles) {
  try {
    const mod = await import(pathToFileURL(path.join(dir, file)).href)
    const fiber = ctx.plugin(mod, {})
    fibers.push(fiber)
    mounted.push([file, fiber])
    await fiber
  } catch (err) {
    console.error(`[run] ${file}: failed to mount -`, err instanceof Error ? err.message : err)
  }
}

// Dependency-driven fibers can still be PENDING right after their own
// mount call returns - a later file in this same loop may be exactly
// what they were waiting on. Wait one tick for the whole batch to
// settle before reporting real, final states - not a premature
// mount-order snapshot.
await sleep(200)
for (const [file, fiber] of mounted) {
  console.log(`[run] ${file}: ${STATE_NAMES[fiber.state] ?? fiber.state}`)
}

console.log(`[run] listening on http://${ctx.webServer.host}:${ctx.webServer.port} - try /healthz`)
console.log(`[run] ${fibers.length} plugin(s) mounted. Ctrl+C to stop.`)

process.on('SIGINT', async () => {
  console.log('\n[run] disposing...')
  for (const fiber of fibers) await fiber.dispose()
  process.exit(0)
})
