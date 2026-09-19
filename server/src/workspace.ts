/**
 * Workspace - a single sandboxed directory the agent is allowed to touch.
 * This is where the agent writes real Cordis plugin files.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store'])

// Source of the reference docs + verified examples the agent reads on demand
// (pi.dev pattern: docs/ + examples/ + a manifest, not a giant prompt). Lives
// in this repo at server/agent-context/; copied into the workspace because the
// agent's file tools are sandboxed to the workspace root.
const AGENT_CONTEXT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../agent-context')

export class Workspace {
  readonly root: string

  constructor(root: string) {
    this.root = root
  }

  resolve(rel: string): string {
    if (path.isAbsolute(rel)) {
      throw new Error(`Absolute paths are not allowed: ${rel}`)
    }
    const target = path.resolve(this.root, rel)
    const relFromRoot = path.relative(this.root, target)
    if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
      throw new Error(`Path escapes the workspace: ${rel}`)
    }
    return target
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true })
    await this.seed()
  }

  async seed(force = false): Promise<void> {
    await this.seedFile(
      'README.md',
      [
        '# Cordis plugin workspace',
        '',
        'This is your sandbox. Write real Cordis plugin files here, then call',
        'mount_plugin to activate one in the live Context and see its real',
        'lifecycle (Fiber state, services, effects, events) on the canvas.',
        '',
        '`hello-plugin.mjs` is a starter file - a real, minimal, mountable',
        'plugin with no config yet, ready to read and extend.',
        '',
        '## Running this folder on its own',
        '',
        'This directory is a real, portable Node project - not just files the',
        'tutorial mounts internally. Copy it anywhere and run it standalone:',
        '',
        '```sh',
        'pnpm install   # or: npm install',
        'pnpm dev       # or: npm run dev',
        '```',
        '',
        '`run.mjs` boots a real @deepseek-ai/cordis Context, hosted with',
        '@deepseek-ai/dsh-host-webserver (the real DeepSeek Harness way to',
        'host a web-facing Context - not an ad hoc keep-alive hack), on',
        'http://127.0.0.1:8790 (try /healthz). It mounts every `*.mjs` plugin',
        'file in this directory into that Context, the same way this',
        "tutorial's own server does via mount_plugin - just without the",
        "tutorial's UI around it.",
        '',
        'A plugin file itself does not import @deepseek-ai/cordis - only the',
        'host (run.mjs, or this tutorial\'s server) does that and passes `ctx`',
        'in. That is the normal Cordis plugin shape, the same as every chapter',
        'example.',
        '',
      ].join('\n'),
      force,
    )
    // A real starter plugin, not just a README reference to one - the
    // "Read hello-plugin.mjs and extend it" suggestion in the agent console
    // depends on this file genuinely existing on disk.
    await this.seedFile(
      'hello-plugin.mjs',
      [
        "export const name = 'hello-plugin'",
        '',
        'export function apply(ctx) {',
        "  console.log('[hello-plugin] active')",
        '}',
        '',
      ].join('\n'),
      force,
    )
    await this.syncAgentContext()
    // This directory sits nested inside this repo's own pnpm-workspace.yaml
    // (a monorepo). Without its own pnpm-workspace.yaml, `pnpm install` run
    // from inside here walks up, finds the outer one, and silently treats
    // this folder as an undeclared member of THAT workspace instead of
    // installing its own dependencies locally - `@deepseek-ai/cordis` never
    // actually lands in node_modules, and `pnpm dev` fails with
    // ERR_MODULE_NOT_FOUND. This file makes pnpm stop the upward search
    // here, so this folder installs and runs as the genuinely standalone
    // project the README promises - both in place and after being copied
    // anywhere else.
    await this.seedFile('pnpm-workspace.yaml', ['packages:', '  - .', ''].join('\n'), force)
    await this.seedFile(
      'package.json',
      JSON.stringify(
        {
          name: 'cordis-plugin-workspace',
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: { dev: 'node run.mjs', start: 'node run.mjs' },
          dependencies: {
            '@deepseek-ai/cordis': '^4.0.2',
            '@deepseek-ai/schemastery': '^3.18.2',
            '@deepseek-ai/dsh-host-webserver': '0.1.5-alpha.1',
          },
        },
        null,
        2,
      ) + '\n',
      force,
    )
    // The real, standalone host: `pnpm install && pnpm dev` runs this
    // directory as its own Cordis app, independent of the tutorial server.
    // Hosted the way DeepSeek Harness itself hosts a web-facing Context -
    // @deepseek-ai/dsh-host-webserver's WebServer Service (a thin
    // node:http wrapper: register()/registerFallback(), no Express) - not
    // an ad hoc keep-alive hack. The listening server keeps the process
    // alive on its own; mounting plugins is the same real ctx.plugin() call
    // mount_plugin makes, just self-hosted.
    await this.seedFile(
      'run.mjs',
      [
        "import { Context } from '@deepseek-ai/cordis'",
        "import WebServer from '@deepseek-ai/dsh-host-webserver'",
        "import { readdir } from 'node:fs/promises'",
        "import { fileURLToPath, pathToFileURL } from 'node:url'",
        "import path from 'node:path'",
        '',
        'const dir = path.dirname(fileURLToPath(import.meta.url))',
        "const STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']",
        '',
        'const ctx = new Context()',
        'const fibers = []',
        '',
        'function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }',
        '',
        "await ctx.plugin(WebServer, { host: '127.0.0.1', port: Number(process.env.PORT) || 8790 })",
        '',
        'ctx.webServer.register({',
        "  kind: 'exact',",
        "  path: '/healthz',",
        '  handler: (_req, res) => {',
        "    res.writeHead(200, { 'content-type': 'text/plain' })",
        "    res.end('ok')",
        '  },',
        '})',
        '',
        'const entries = await readdir(dir, { withFileTypes: true })',
        'const pluginFiles = entries',
        "  .filter((e) => e.isFile() && e.name.endsWith('.mjs') && e.name !== 'run.mjs')",
        '  .map((e) => e.name)',
        '  .sort()',
        '',
        'if (pluginFiles.length === 0) {',
        "  console.log('[run] no plugin files found (looked for *.mjs, excluding run.mjs)')",
        '}',
        '',
        'const mounted = []',
        'for (const file of pluginFiles) {',
        '  try {',
        '    const mod = await import(pathToFileURL(path.join(dir, file)).href)',
        '    const fiber = ctx.plugin(mod, {})',
        '    fibers.push(fiber)',
        '    mounted.push([file, fiber])',
        '    await fiber',
        '  } catch (err) {',
        "    console.error(`[run] ${file}: failed to mount -`, err instanceof Error ? err.message : err)",
        '  }',
        '}',
        '',
        '// Dependency-driven fibers can still be PENDING right after their own',
        '// mount call returns - a later file in this same loop may be exactly',
        '// what they were waiting on. Wait one tick for the whole batch to',
        '// settle before reporting real, final states - not a premature',
        '// mount-order snapshot.',
        'await sleep(200)',
        'for (const [file, fiber] of mounted) {',
        '  console.log(`[run] ${file}: ${STATE_NAMES[fiber.state] ?? fiber.state}`)',
        '}',
        '',
        'console.log(`[run] listening on http://${ctx.webServer.host}:${ctx.webServer.port} - try /healthz`)',
        'console.log(`[run] ${fibers.length} plugin(s) mounted. Ctrl+C to stop.`)',
        '',
        "process.on('SIGINT', async () => {",
        "  console.log('\\n[run] disposing...')",
        '  for (const fiber of fibers) await fiber.dispose()',
        '  process.exit(0)',
        '})',
        '',
      ].join('\n'),
      force,
    )
  }

  /**
   * Copies agent-context/{docs,examples}/ into the workspace. Unlike seedFile,
   * this ALWAYS overwrites: it is managed reference material (rewritten on
   * every server start and workspace reset so it can never go stale), not
   * something the agent or user is expected to edit. Copy an example to the
   * workspace root to modify it.
   */
  private async syncAgentContext(): Promise<void> {
    const copyDir = async (from: string, to: string): Promise<void> => {
      await fs.mkdir(to, { recursive: true })
      for (const entry of await fs.readdir(from, { withFileTypes: true })) {
        if (IGNORED.has(entry.name)) continue
        const src = path.join(from, entry.name)
        const dest = path.join(to, entry.name)
        if (entry.isDirectory()) await copyDir(src, dest)
        else await fs.copyFile(src, dest)
      }
    }
    for (const dir of ['docs', 'examples']) {
      await copyDir(path.join(AGENT_CONTEXT_SRC, dir), path.join(this.root, dir))
    }
  }

  /** Writes a seed file only if missing (or always, when force-resetting) - never clobbers a file the agent or user has since edited. */
  private async seedFile(rel: string, content: string, force: boolean): Promise<void> {
    const target = path.join(this.root, rel)
    if (!force) {
      try {
        await fs.access(target)
        return
      } catch {
        // missing - create below
      }
    }
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, 'utf8')
  }

  async list(): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: string, prefix: string) => {
      let entries: import('node:fs').Dirent[]
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (IGNORED.has(e.name)) continue
        const rel = prefix ? `${prefix}/${e.name}` : e.name
        if (e.isDirectory()) {
          out.push(`${rel}/`)
          await walk(path.join(dir, e.name), rel)
        } else {
          out.push(rel)
        }
      }
    }
    await walk(this.root, '')
    return out.sort()
  }

  async readFile(rel: string): Promise<string> {
    return fs.readFile(this.resolve(rel), 'utf8')
  }

  async snapshot(): Promise<Record<string, string>> {
    const snapshot: Record<string, string> = {}
    for (const rel of await this.list()) {
      if (rel.endsWith('/')) continue
      try {
        const content = await this.readFile(rel)
        if (content.length <= 500_000) snapshot[rel] = content
      } catch {
        // Binary/unreadable files are still visible in the tree, but omitted
        // from the text diff baseline.
      }
    }
    return snapshot
  }

  async writeFile(rel: string, content: string): Promise<'create' | 'edit'> {
    const target = this.resolve(rel)
    let existed = false
    try {
      await fs.access(target)
      existed = true
    } catch {
      existed = false
    }
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, 'utf8')
    return existed ? 'edit' : 'create'
  }

  async editFile(rel: string, oldStr: string, newStr: string): Promise<'create' | 'edit'> {
    const target = this.resolve(rel)
    if (oldStr === '') {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, newStr, 'utf8')
      return 'create'
    }
    const original = await fs.readFile(target, 'utf8')
    const occurrences = original.split(oldStr).length - 1
    if (occurrences === 0) throw new Error(`old_str not found in ${rel}.`)
    if (occurrences > 1) throw new Error(`old_str appears ${occurrences} times in ${rel}; it must be unique. Include more surrounding context.`)
    await fs.writeFile(target, original.replace(oldStr, newStr), 'utf8')
    return 'edit'
  }

  async reset(): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(this.root, { withFileTypes: true })
    } catch {
      await fs.mkdir(this.root, { recursive: true })
      await this.seed(true)
      return
    }
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue
      await fs.rm(path.join(this.root, e.name), { recursive: true, force: true })
    }
    await this.seed(true)
  }
}
