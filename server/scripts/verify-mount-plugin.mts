/**
 * One-off verification for mount_plugin + the pendingSourcePath fix. Bypasses
 * the LLM entirely (no DeepSeek key needed) - drives the real tool function
 * directly against a real instrumented Context and a scratch workspace.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInstrumentedContext } from '../src/cordis-instrumentation.js'
import { Workspace } from '../src/workspace.js'
import { mountPlugin } from '../src/tools/mount-plugin.js'
import type { TraceEvent } from '@cordis-tutorial/shared'

const dir = mkdtempSync(path.join(tmpdir(), 'cordis-verify-'))
const workspace = new Workspace(dir)
await workspace.ensure()

const events: TraceEvent[] = []
const instr = createInstrumentedContext((e) => events.push(e), { workspace, getProviderConfig: () => null })

async function main() {
  await workspace.writeFile(
    'greeter.mjs',
    [
      "export const name = 'greeter'",
      'export function apply(ctx, config = {}) {',
      "  console.log('greeter mounted', config)",
      '}',
    ].join('\n'),
  )

  const r1 = await mountPlugin.run({ path: 'greeter.mjs' }, { workspace, emit: (e) => events.push(e), instr })
  console.log('mount #1:', r1)

  const registerEvent = events.find((e) => e.type === 'plugin_register')
  const stateEvent = events.find((e) => e.type === 'fiber_state_change' && e.to === 'ACTIVE')
  if (!registerEvent || registerEvent.type !== 'plugin_register') throw new Error('FAIL: no plugin_register event')
  if (registerEvent.sourcePath !== 'greeter.mjs') throw new Error(`FAIL: sourcePath was ${JSON.stringify(registerEvent.sourcePath)}, expected 'greeter.mjs'`)
  if (!stateEvent || stateEvent.type !== 'fiber_state_change') throw new Error('FAIL: plugin never reached ACTIVE')
  if (stateEvent.pluginId !== registerEvent.pluginId) throw new Error('FAIL: pluginId mismatch between plugin_register and fiber_state_change')
  console.log('PASS: sourcePath correctly attributed, pluginId consistent across event types')

  // Edit and re-mount: should dispose the old fiber and mount fresh.
  events.length = 0
  await workspace.writeFile(
    'greeter.mjs',
    [
      "export const name = 'greeter'",
      'export function apply(ctx, config = {}) {',
      "  console.log('greeter mounted v2', config)",
      '}',
    ].join('\n'),
  )
  const r2 = await mountPlugin.run({ path: 'greeter.mjs', config: { who: 'world' } }, { workspace, emit: (e) => events.push(e), instr })
  console.log('mount #2 (re-mount after edit):', r2)
  const disposeEvent = events.find((e) => e.type === 'fiber_state_change' && e.from === 'ACTIVE')
  if (!disposeEvent) throw new Error('FAIL: re-mount did not dispose the previous fiber')
  console.log('PASS: re-mount disposed the previous fiber before mounting the edited version')

  // Deliberately broken plugin: mount_plugin should report FAILED with the real error.
  events.length = 0
  await workspace.writeFile('broken.mjs', "export function apply(ctx) { throw new Error('boom') }")
  const r3 = await mountPlugin.run({ path: 'broken.mjs' }, { workspace, emit: (e) => events.push(e), instr })
  console.log('mount #3 (broken plugin):', r3)
  if (!r3.isError || !r3.result.includes('boom')) throw new Error('FAIL: broken plugin did not surface its real error')
  console.log('PASS: broken plugin surfaces its real error, not a generic failure')
}

try {
  await main()
  console.log('\nALL CHECKS PASSED')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
