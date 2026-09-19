// compact-selftest.mjs - a deliberate PROBE, not product code.
//
// Purpose: prove the real serial dispatch of 'agent-harness/compact' actually
// reaches compaction.mjs's listener, and that its two branches (compact /
// decline) return what they claim. It has no other way to show its result to
// the outside world, so it reports by THROWING: mount_plugin surfaces the real
// error text, which is the observable evidence.
//
// Expect: FAILED, with a SELFTEST message naming both branches' results.
export const name = 'compact-selftest'
export const inject = ['compaction', 'contextWindow']

const EVENT = 'agent-harness/compact'

export async function apply(ctx) {
  const system = { role: 'system', content: 'You are a coding agent.' }
  const older = Array.from({ length: 12 }, (_, i) => ({
    role: 'user',
    content: `older message ${i + 1}`,
  }))
  const messages = [system, ...older]

  // Branch 1: over threshold -> a shortened array.
  const over = await ctx.serial(EVENT, { messages, estimatedTokens: 9000 })

  // Branch 2: under threshold -> undefined (decline; the next listener decides).
  const under = await ctx.serial(EVENT, { messages, estimatedTokens: 10 })

  const roles = Array.isArray(over) ? over.map((m) => m.role).join(',') : String(over)
  const summary = `over(9000 tokens) -> length ${over?.length} roles [${roles}]; ` +
    `under(10 tokens) -> ${under === undefined ? 'undefined (declined)' : JSON.stringify(under)}; ` +
    `listener hits = ${ctx.compaction.hits}`

  // This file passes or fails as a real assertion: ACTIVE = both branches
  // behaved, FAILED = the error text names what was wrong.
  const ok =
    Array.isArray(over) &&
    over.length === 8 &&
    over[0].role === 'system' &&
    over[1].content.startsWith('[compaction]') &&
    under === undefined

  if (!ok) throw new Error(`SELFTEST FAILED: ${summary}`)
  console.log(`[compact-selftest] PASS - ${summary}`)
}
