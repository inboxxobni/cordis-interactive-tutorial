/**
 * Verifies the Volume 2 MECHANISM for real, bypassing the LLM entirely
 * (same spirit as verify-mount-plugin.mts): writes real .mjs files matching
 * the shapes the system prompt/chip prompts describe directly into a
 * scratch workspace, mounts them one at a time via the real mountPlugin
 * tool - the exact path the connected agent itself would take - and
 * asserts agentLoop's fiber genuinely goes PENDING -> ... -> ACTIVE as its
 * real dependencies land, then that run_workspace_agent_turn drives a real
 * turn through it (a real tool_use round-trip against a stubbed llm.mjs,
 * so the test is deterministic - this checks the mechanism, not a live
 * provider).
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInstrumentedContext } from '../src/cordis-instrumentation.js'
import { Workspace } from '../src/workspace.js'
import { mountPlugin } from '../src/tools/mount-plugin.js'
import { runWorkspaceAgentTurn } from '../src/tools/run-workspace-agent.js'
import { fiberId, stateName } from '../src/cordis-instrumentation.js'
import type { TraceEvent } from '@cordis-tutorial/shared'

const dir = mkdtempSync(path.join(tmpdir(), 'cordis-verify-agent-harness-workspace-'))
const workspace = new Workspace(dir)
await workspace.ensure()

const events: TraceEvent[] = []
const emit = (e: TraceEvent) => events.push(e)
const instr = createInstrumentedContext(emit)
const toolCtx = { workspace, emit, instr }

// Real, current state - walking the live registry directly (the same real
// API cordis_inspect_list/query use), not event-log archaeology: mounting
// an unrelated new dependency doesn't re-emit a "still PENDING" event for
// agentLoop's own fiber, since its own state value hasn't changed.
function agentLoopFiberState(): string | undefined {
  for (const runtime of instr.ctx.registry.values()) {
    for (const fiber of runtime.fibers) {
      if (fiberId(fiber) === 'agent-loop#1') return stateName(fiber.state)
    }
  }
  return undefined
}

async function mount(file: string): Promise<void> {
  events.length = 0
  const result = await mountPlugin.run({ path: file }, toolCtx)
  if (result.isError) throw new Error(`FAIL mounting ${file}: ${result.result}`)
}

// Object-plugin form here (not the class form the real chip prompt asks
// for) purely to avoid needing @deepseek-ai/cordis resolvable from this
// disposable tmp scratch dir's own node_modules (the real workspace/
// already has it installed for real - confirmed earlier this session).
// Dependency-driven PENDING/ACTIVE is identical for all three real plugin
// forms (chapter 8's own lesson), so this still verifies the real
// mechanism this test exists to check.
await workspace.writeFile(
  'agent-loop.mjs',
  [
    "export const name = 'agent-loop'",
    "export const inject = ['tools', 'llm', 'systemPrompt']",
    'const messages = []',
    'export function apply(ctx) {',
    '  ctx.provide(\'agentLoop\', {',
    '    async runTurn(task) {',
    "      messages.push({ role: 'user', content: task })",
    '      for (let step = 0; step < 10; step++) {',
    '        const systemText = await ctx.systemPrompt.assemble()',
    "        const withSystem = [{ role: 'system', content: systemText }, ...messages]",
    '        const response = await ctx.llm.chat(withSystem, ctx.tools.definitions)',
    "        messages.push({ role: 'assistant', content: response.toolCalls })",
    '        if (!response.toolCalls || response.toolCalls.length === 0) return',
    '        const results = []',
    '        for (const call of response.toolCalls) {',
    '          const run = await ctx.tools.execute(call.name, call.input)',
    "          results.push({ type: 'tool_result', tool_use_id: call.id, content: run.result })",
    '        }',
    "        messages.push({ role: 'user', content: results })",
    '      }',
    '    },',
    '  })',
    '}',
  ].join('\n'),
)
await mount('agent-loop.mjs')
if (agentLoopFiberState() !== 'PENDING') throw new Error(`FAIL (agent-loop.mjs alone): expected PENDING, got ${agentLoopFiberState()}`)
console.log('PASS (agent-loop.mjs alone): agentLoop PENDING, as expected')

await workspace.writeFile(
  'tools.mjs',
  [
    "import { readFile, writeFile, readdir } from 'node:fs/promises'",
    "import { fileURLToPath } from 'node:url'",
    "import path from 'node:path'",
    'const dir = path.dirname(fileURLToPath(import.meta.url))',
    'export function apply(ctx) {',
    '  const definitions = [',
    "    { name: 'write_file', description: 'write a file', input_schema: { type: 'object', properties: {} } },",
    "    { name: 'read_file', description: 'read a file', input_schema: { type: 'object', properties: {} } },",
    '  ]',
    '  async function execute(name, input) {',
    "    if (name === 'write_file') { await writeFile(path.join(dir, input.path), input.content); return { result: 'ok', isError: false } }",
    "    if (name === 'read_file') { return { result: await readFile(path.join(dir, input.path), 'utf8'), isError: false } }",
    "    return { result: 'unknown tool', isError: true }",
    '  }',
    "  ctx.provide('tools', { definitions, execute })",
    '}',
  ].join('\n'),
)
await mount('tools.mjs')
if (agentLoopFiberState() !== 'PENDING') throw new Error(`FAIL (+ tools.mjs): expected PENDING, got ${agentLoopFiberState()}`)
console.log('PASS (+ tools.mjs): agentLoop still PENDING, as expected')

await workspace.writeFile(
  'system-prompt.mjs',
  ["export function apply(ctx) {", "  ctx.provide('systemPrompt', { async assemble() { return 'you are a test agent' } })", '}'].join('\n'),
)
await mount('system-prompt.mjs')
if (agentLoopFiberState() !== 'PENDING') throw new Error(`FAIL (+ system-prompt.mjs): expected PENDING, got ${agentLoopFiberState()}`)
console.log('PASS (+ system-prompt.mjs): agentLoop still PENDING, as expected')

// Stubbed llm.mjs (deterministic, no network) - verifies the MECHANISM:
// first call requests a real write_file tool call, second call ends the
// turn. A real one (built by the connected agent) would fetch() a real
// provider using process.env.CORDIS_AGENT_*, per the system prompt.
await workspace.writeFile(
  'llm.mjs',
  [
    'let call = 0',
    'export function apply(ctx) {',
    '  ctx.provide(\'llm\', {',
    '    async chat(messages, tools) {',
    '      call += 1',
    '      if (call === 1) return { toolCalls: [{ id: "1", name: "write_file", input: { path: "agent-wrote-this.txt", content: "hello from the built agent" } }] }',
    '      return { toolCalls: [] }',
    '    },',
    '  })',
    '}',
  ].join('\n'),
)
await mount('llm.mjs')
if (agentLoopFiberState() !== 'ACTIVE') throw new Error(`FAIL (+ llm.mjs): expected ACTIVE, got ${agentLoopFiberState()}`)
console.log('PASS (+ llm.mjs): agentLoop flipped PENDING -> ACTIVE for real')

const turnResult = await runWorkspaceAgentTurn.run({ task: 'write a file' }, toolCtx)
if (turnResult.isError) throw new Error(`FAIL: run_workspace_agent_turn errored: ${turnResult.result}`)
const written = await workspace.readFile('agent-wrote-this.txt')
if (written !== 'hello from the built agent') throw new Error(`FAIL: expected file content mismatch, got ${JSON.stringify(written)}`)
console.log('PASS: run_workspace_agent_turn drove a real turn that executed a real tool call and wrote a real file')

console.log('\nALL CHECKS PASSED')
