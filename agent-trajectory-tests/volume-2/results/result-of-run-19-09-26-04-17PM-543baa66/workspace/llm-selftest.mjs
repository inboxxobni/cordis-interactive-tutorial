// llm-selftest.mjs - PROBE: one REAL round-trip through ctx.llm.chat().
//
// Purpose: prove the adapter actually makes a working HTTP call and normalizes
// the reply to the shape agent-loop.mjs expects ({role, content, tool_calls}).
// Cost: one tiny completion. No key is ever read or printed here.
//
// Expect: ACTIVE (pass) - FAILED carries the real error / the failing assertion.
export const name = 'llm-selftest'
export const inject = ['llm']

export async function apply(ctx) {
  const before = ctx.llm.calls
  const reply = await ctx.llm.chat([
    { role: 'user', content: 'Reply with exactly: OK' },
  ])

  const checks = {
    calledOnce: ctx.llm.calls === before + 1,
    roleAssistant: reply?.role === 'assistant',
    contentIsString: typeof reply?.content === 'string',
    contentNotEmpty: (reply?.content ?? '').trim().length > 0,
    usageReceived: ctx.llm.lastUsage != null,
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)

  const summary =
    `provider=${ctx.llm.provider} model=${ctx.llm.model} ` +
    `reply=${JSON.stringify(reply?.content?.slice(0, 40))} usage=${JSON.stringify(ctx.llm.lastUsage)} ` +
    `failed=${JSON.stringify(failed)}`

  if (failed.length) throw new Error(`LLM SELFTEST FAILED: ${summary}`)
  console.log(`[llm-selftest] PASS - real round-trip: ${summary}`)
}
