import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

const ctx = new Context()
const fibers = []

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

for (const file of pluginFiles) {
  try {
    const mod = await import(pathToFileURL(path.join(dir, file)).href)
    const fiber = ctx.plugin(mod, {})
    fibers.push(fiber)
    await fiber
    console.log(`[run] ${file}: ${STATE_NAMES[fiber.state] ?? fiber.state}`)
  } catch (err) {
    console.error(`[run] ${file}: failed to mount -`, err instanceof Error ? err.message : err)
  }
}

console.log(`[run] listening on http://${ctx.webServer.host}:${ctx.webServer.port} - try /healthz`)
console.log(`[run] ${fibers.length} plugin(s) mounted. Ctrl+C to stop.`)

process.on('SIGINT', async () => {
  console.log('\n[run] disposing...')
  for (const fiber of fibers) await fiber.dispose()
  process.exit(0)
})
