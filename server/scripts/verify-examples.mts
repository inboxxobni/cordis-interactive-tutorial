/**
 * Mounts every scenario in agent-context/examples/scenarios.json into a fresh
 * REAL @deepseek-ai/cordis Context and checks the declared outcomes (fiber
 * states, logs, services, errors). This is what makes the examples
 * trustworthy references rather than plausible-looking code: each one has been
 * observed to do what its header claims. Run: npx tsx scripts/verify-examples.mts
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'

const here = path.dirname(fileURLToPath(import.meta.url))
const examplesRoot = path.resolve(here, '../agent-context/examples')
const STATE = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

type Step =
  | { mount: string; config?: Record<string, unknown>; expect: string; expectError?: string }
  | { dispose: string }
  | { expectState: Record<string, string> }
  | { expectLog: string }
  | { expectService: string }
interface Scenario { id: string; steps: Step[]; env?: Record<string, string> }

const scenarios = JSON.parse(await readFile(path.join(examplesRoot, 'scenarios.json'), 'utf8')) as Scenario[]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const only = process.argv[2]

let failures = 0
{
  // The examples index must mention every example file, so it cannot rot.
  const { readdir } = await import('node:fs/promises')
  const readme = await readFile(path.join(examplesRoot, 'README.md'), 'utf8')
  const missing: string[] = []
  for (const dir of ['plugins', 'coding-agent']) {
    for (const f of await readdir(path.join(examplesRoot, dir))) {
      if (!readme.includes(f)) missing.push(`${dir}/${f}`)
    }
  }
  if (missing.length) { failures++; console.log(`FAIL README lists`); for (const m of missing) console.log(`   - examples/README.md does not mention ${m}`) }
  else console.log('ok   README lists every example file')
}
for (const scenario of scenarios) {
  if (only && scenario.id !== only) continue
  const savedEnv: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(scenario.env ?? {})) { savedEnv[k] = process.env[k]; process.env[k] = v }
  const ctx = new Context()
  const fibers = new Map<string, ReturnType<Context['plugin']>>()
  const logs: string[] = []
  const realLog = console.log
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
  const problems: string[] = []

  try {
    for (const step of scenario.steps) {
      if ('mount' in step) {
        const abs = path.join(examplesRoot, step.mount)
        const prior = fibers.get(step.mount)
        if (prior) await prior.dispose()
        const mod = await import(`${pathToFileURL(abs).href}?t=${Date.now()}${Math.random()}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fiber = ctx.plugin(mod as any, step.config ?? {})
        fibers.set(step.mount, fiber)
        let error = ''
        try { await fiber.await() } catch (err) { error = err instanceof Error ? err.message : String(err) }
        await sleep(30)
        const state = STATE[fiber.state]
        if (state !== step.expect) problems.push(`mount ${step.mount}: expected ${step.expect}, got ${state}${error ? ` (${error})` : ''}`)
        if (step.expectError && !error.includes(step.expectError)) problems.push(`mount ${step.mount}: expected error containing "${step.expectError}", got "${error}"`)
      } else if ('dispose' in step) {
        await fibers.get(step.dispose)?.dispose()
        await sleep(30)
      } else if ('expectState' in step) {
        await sleep(50)
        for (const [p, want] of Object.entries(step.expectState)) {
          const got = STATE[fibers.get(p)?.state ?? -1]
          if (got !== want) problems.push(`state ${p}: expected ${want}, got ${got}`)
        }
      } else if ('expectLog' in step) {
        if (!logs.some((l) => l.includes(step.expectLog))) problems.push(`log not seen: "${step.expectLog}" (saw: ${JSON.stringify(logs)})`)
      } else if ('expectService' in step) {
        if (!ctx.get(step.expectService as never)) problems.push(`service not resolved: ${step.expectService}`)
      }
    }
  } catch (err) {
    problems.push(`threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  } finally {
    console.log = realLog
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    for (const f of fibers.values()) { try { await f.dispose() } catch { /* already gone */ } }
  }

  if (problems.length) {
    failures++
    console.log(`FAIL ${scenario.id}`)
    for (const p of problems) console.log(`   - ${p}`)
  } else {
    console.log(`ok   ${scenario.id}`)
  }
}
console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nall scenarios verified')
process.exit(failures ? 1 : 0)
