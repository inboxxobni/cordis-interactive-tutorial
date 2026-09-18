/**
 * mount_plugin: the agent's real feedback loop. It dynamically imports a
 * workspace file and mounts it into the session's shared, instrumented
 * Cordis Context via ctx.plugin() - the exact same call a real Loader makes.
 * Re-mounting the same path disposes the previous fiber first, so an
 * edit-then-remount cycle behaves like real hot-reload. The tool result
 * reports the real settled Fiber state (ACTIVE, or the real error on
 * FAILED/PENDING) so the agent debugs against ground truth, not a guess.
 */
import { pathToFileURL } from 'node:url'
import type { Tool, ToolRunResult } from './registry.js'

export const mountPlugin: Tool = {
  def: {
    name: 'mount_plugin',
    description:
      'Mount (or re-mount, after an edit) a Cordis plugin file from the workspace into the live Context. Returns the real settled Fiber state and any error. This is how you activate and test what you just wrote.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the plugin file (e.g. "hello-plugin.mjs").' },
        config: { type: 'object', description: 'Optional plugin config object.' },
      },
      required: ['path'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const rel = String(input.path ?? '')
    if (!rel) return { result: 'Error: path is required', isError: true }
    const config = (input.config as Record<string, unknown> | undefined) ?? {}

    const absolute = ctx.workspace.resolve(rel)

    const existing = ctx.instr.mountedPaths.get(absolute)
    if (existing) {
      await existing.dispose()
      ctx.instr.mountedPaths.delete(absolute)
    }

    let mod: unknown
    try {
      // Cache-bust so an edited file is actually re-evaluated, not served
      // from Node's ESM module cache.
      mod = await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { result: `Import failed: ${message}`, isError: true }
    }

    let fiber: ReturnType<typeof ctx.instr.ctx.plugin>
    try {
      // Read by the internal/plugin handler synchronously inside
      // ctx.plugin() below - see Instrumented.pendingSourcePath's doc.
      ctx.instr.pendingSourcePath = rel
      // Dynamically imported agent-written code has no static shape Cordis's
      // Plugin type can check - this is the one legitimate boundary cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fiber = ctx.instr.ctx.plugin(mod as any, config)
      ctx.instr.mountedPaths.set(absolute, fiber)
      await fiber.await()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { result: `Mounted but failed to activate: ${message}. Check the Fiber state in the canvas for the real cause.`, isError: true }
    }

    return { result: `Mounted ${rel}. Fiber is now ${stateName(fiber.state)}.`, isError: fiber.state === 3 /* FAILED */ }
  },
}

const STATE_NAMES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']
function stateName(state: number): string {
  return STATE_NAMES[state] ?? 'PENDING'
}
