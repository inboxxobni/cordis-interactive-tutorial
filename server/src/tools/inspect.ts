/**
 * Real, read-only introspection over the live Cordis registry - the tutorial's
 * own outer agent's version of the real @deepseek-ai/dsh-tool-cordis package
 * (see chapter 15's theory: "lists available services/providers and their
 * exact signatures... cannot mount, unmount, or invoke anything"). Walks
 * `ctx.registry.values()` directly - the exact real API chapter 6's own
 * diagnose.ts example already teaches - not a reconstruction from trace
 * events. This exists because the outer agent's other tools (list_files,
 * read_file, ...) only see the workspace/ sandbox: a Volume 2 chapter's real
 * plugins live compiled into this server's own chapters/agent-harness/, with
 * no source file in the workspace to read - without a real way to inspect
 * the live Context, a question like "why is agentLoop PENDING right now"
 * has no honest answer available to the agent at all, and it should refuse
 * rather than guess (which is exactly what it correctly did before this
 * tool existed).
 */
import type { Tool, ToolRunResult } from './registry.js'
import { fiberId, stateName } from '../cordis-instrumentation.js'

export const cordisInspectList: Tool = {
  def: {
    name: 'cordis_inspect_list',
    description:
      'List every plugin currently mounted in the live Cordis Context right now: its id (matching the canvas), real fiber state (PENDING/LOADING/ACTIVE/FAILED/UNLOADING/DISPOSED), and declared inject list. Read-only - cannot mount, unmount, or invoke anything.',
    input_schema: { type: 'object', properties: {} },
  },
  async run(_input, ctx): Promise<ToolRunResult> {
    const rows: string[] = []
    for (const runtime of ctx.instr.ctx.registry.values()) {
      for (const fiber of runtime.fibers) {
        const inject = Object.keys(fiber.inject ?? {})
        rows.push(`${fiberId(fiber)}  state=${stateName(fiber.state)}  inject=[${inject.join(', ') || '(none)'}]`)
      }
    }
    return { result: rows.length ? rows.join('\n') : '(no plugins mounted right now)', isError: false }
  },
}

export const cordisInspectQuery: Tool = {
  def: {
    name: 'cordis_inspect_query',
    description:
      'Look up one currently-mounted plugin by the exact id from cordis_inspect_list, and report its real fiber state, its declared inject list, and for each injected service name whether it currently resolves to a real provider or is still missing. Read-only.',
    input_schema: {
      type: 'object',
      properties: { pluginId: { type: 'string', description: 'Exact id from cordis_inspect_list, e.g. "AgentLoop#3".' } },
      required: ['pluginId'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const target = String(input.pluginId ?? '')
    if (!target) return { result: 'Error: pluginId is required - call cordis_inspect_list first to get one.', isError: true }
    for (const runtime of ctx.instr.ctx.registry.values()) {
      for (const fiber of runtime.fibers) {
        if (fiberId(fiber) !== target) continue
        const inject = Object.keys(fiber.inject ?? {})
        const resolution = inject.map((name) => `  - ${name}: ${ctx.instr.ctx.get(name) !== undefined ? 'provided' : 'MISSING - nothing provides this service yet'}`)
        return {
          result: [`id: ${target}`, `state: ${stateName(fiber.state)}`, `inject: [${inject.join(', ') || '(none)'}]`, ...resolution].join('\n'),
          isError: false,
        }
      }
    }
    return { result: `Error: no currently-mounted plugin with id "${target}" - call cordis_inspect_list first to get a real, current id.`, isError: true }
  },
}
