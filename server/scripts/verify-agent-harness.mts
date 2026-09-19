/**
 * One-off verification for Volume 2 (chapters 17-23): mounts the cumulative
 * composition chapters 17->22 each produce, in order, against a real
 * instrumented Context, and asserts agentLoop's fiber state matches what
 * the theory claims - PENDING through 17-21, ACTIVE the moment chapter 22
 * mounts llm. Then drives one real turn through chapter 23's composition
 * with a stub provider (no real API key/network needed), and asserts a
 * real tool call actually wrote a file.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInstrumentedContext } from '../src/cordis-instrumentation.js'
import { Workspace } from '../src/workspace.js'
import { composeAgentHarness } from '../src/chapters/agent-harness/compose.js'
import type { TraceEvent, ProviderConfig } from '@cordis-tutorial/shared'

const dir = mkdtempSync(path.join(tmpdir(), 'cordis-verify-agent-harness-'))
const workspace = new Workspace(dir)
await workspace.ensure()

let providerConfig: ProviderConfig | null = null
const events: TraceEvent[] = []
const instr = createInstrumentedContext((e) => events.push(e), { workspace, getProviderConfig: () => providerConfig })

function fiberStateFor(pluginId: string): string | undefined {
  return events.filter((e) => e.type === 'fiber_state_change' && e.pluginId === pluginId).at(-1)?.type === 'fiber_state_change'
    ? (events.filter((e) => e.type === 'fiber_state_change' && e.pluginId === pluginId).at(-1) as { to: string }).to
    : undefined
}

function agentLoopPluginId(): string | undefined {
  // A fiber's diagnostic `name` (plugin_register) is the class name
  // (`AgentLoop`), available the moment it registers, PENDING or not; the
  // `agentLoop` *service* only appears via service_provide once it's
  // actually ACTIVE (the class is only instantiated once inject is met).
  const evt = events.find((e) => e.type === 'plugin_register' && e.name === 'AgentLoop')
  return evt?.type === 'plugin_register' ? evt.pluginId : undefined
}

async function main() {
  // Chapters 17-21: agentLoop mounts alone / with tools/contextWindow/
  // compaction/systemPrompt, but never llm - should stay PENDING every time.
  const steps: { parts: Parameters<typeof composeAgentHarness>[1]; label: string }[] = [
    { parts: {}, label: '17-the-loop' },
    { parts: { tools: true }, label: '18-tools' },
    { parts: { tools: true, contextWindow: true }, label: '19-context-window' },
    { parts: { tools: true, contextWindow: true, compaction: true }, label: '20-cache-and-compact' },
    { parts: { tools: true, contextWindow: true, compaction: true, systemPrompt: true }, label: '21-system-prompt' },
  ]

  for (const step of steps) {
    events.length = 0
    const teardown = await composeAgentHarness(instr, step.parts)
    const id = agentLoopPluginId()
    if (!id) throw new Error(`FAIL (${step.label}): agentLoop never registered`)
    const state = fiberStateFor(id)
    if (state !== 'PENDING') throw new Error(`FAIL (${step.label}): expected agentLoop PENDING, got ${state}`)
    console.log(`PASS (${step.label}): agentLoop PENDING, as expected`)
    await teardown()
  }

  // Chapter 22/23: adds llm - every inject dependency now satisfied.
  providerConfig = { provider: 'openai', model: 'stub', apiKey: 'stub', baseURL: 'http://127.0.0.1:1/unused' }
  events.length = 0
  const teardown = await composeAgentHarness(instr, { tools: true, contextWindow: true, compaction: true, systemPrompt: true, llm: true })
  const id = agentLoopPluginId()
  if (!id) throw new Error('FAIL (22-providers): agentLoop never registered')
  const state = fiberStateFor(id)
  if (state !== 'ACTIVE') throw new Error(`FAIL (22-providers): expected agentLoop ACTIVE, got ${state}`)
  console.log('PASS (22-providers): agentLoop flipped to ACTIVE once llm mounted')

  if (!instr.innerAgentLoop) throw new Error('FAIL (23-the-harness): instr.innerAgentLoop was not set')
  // Drive one real turn, but against a stub llm.chat the actual network
  // call bypasses (agentLoop only calls ctx.get('llm').chat(...), and we can
  // swap the mounted service's chat() for a canned tool-call response - no
  // real network, no API key, still the real loop/tool-execution code path).
  const llmService = instr.ctx.get('llm') as { chat: (...args: unknown[]) => unknown }
  let callCount = 0
  llmService.chat = async () => {
    callCount += 1
    if (callCount === 1) {
      return { text: '', toolCalls: [{ id: 'call-1', name: 'write_file', input: { path: 'agent-harness-check.txt', content: 'hello from the built agent' } }], stopReason: 'tool_use', usage: { input_tokens: 0, output_tokens: 0 } }
    }
    return { text: 'Done.', toolCalls: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } }
  }
  await instr.innerAgentLoop.runTurn('write a file for real')
  const written = await workspace.readFile('agent-harness-check.txt')
  if (written !== 'hello from the built agent') throw new Error(`FAIL (23-the-harness): file content was ${JSON.stringify(written)}`)
  console.log('PASS (23-the-harness): a real turn executed a real tool call and wrote a real file')
  await teardown()

  console.log('\nALL CHECKS PASSED')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
