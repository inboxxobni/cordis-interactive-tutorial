export const name = 'check-compaction'
export const inject = ['compaction', 'contextWindow']

// Throwaway self-check. Dispatches the REAL 'agent-harness/compact' event
// through this Context and asserts on what actually comes back. Its own
// fiber state is the evidence: ACTIVE = every check below held.
export async function apply(ctx) {
  const { compaction, contextWindow } = ctx
  const fail = (msg) => {
    throw new Error(`check-compaction: ${msg}`)
  }

  // --- exercise the real dispatch path -----------------------------------
  // Try the variadic form first; fall back to the args-array form. Record
  // which one actually delivered, so the dispatch shape is measured, not
  // assumed.
  let seenBefore = compaction.hits
  let variadic
  try {
    variadic = await ctx.serial('agent-harness/compact', { messages: [], estimatedTokens: 0 })
  } catch (err) {
    variadic = `threw: ${err?.message ?? err}`
  }
  const variadicDelivered = compaction.hits > seenBefore
  const dispatch = variadicDelivered ? 'variadic (name, payload)' : 'unknown'

  if (!variadicDelivered) {
    seenBefore = compaction.hits
    await ctx.serial('agent-harness/compact', [{ messages: [], estimatedTokens: 0 }])
    if (compaction.hits > seenBefore) {
      fail('args-array dispatch delivered, variadic did not - compaction should accept either')
    }
    fail(
      `listener never ran: ctx.serial from a sibling context did not reach it ` +
        `(hits=${compaction.hits}, serial returned ${JSON.stringify(variadic)})`,
    )
  }

  // --- below threshold: return nothing -----------------------------------
  const small = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hello' },
  ]
  const smallTokens = contextWindow.estimateTokens(small)
  if (smallTokens >= 6000) fail(`fixture unexpectedly large: ${smallTokens}`)
  const smallResult = await ctx.serial('agent-harness/compact', {
    messages: small,
    estimatedTokens: smallTokens,
  })
  if (!returnsNothing(smallResult)) {
    fail(`below threshold should return nothing, got ${JSON.stringify(smallResult)}`)
  }

  // --- above threshold: shortened array, system + newest 6 ---------------
  const big = [{ role: 'system', content: 'sys' }]
  for (let i = 0; i < 20; i++) {
    big.push({ role: 'user', content: `m${i}`.padEnd(2000, 'x') })
  }
  const bigTokens = contextWindow.estimateTokens(big)
  if (bigTokens < 6000) fail(`fixture unexpectedly small: ${bigTokens}`)

  const out = await ctx.serial('agent-harness/compact', { messages: big, estimatedTokens: bigTokens })
  const shortened = pickArray(out)
  if (!shortened) fail(`above threshold should return an array, got ${JSON.stringify(out)}`)

  if (shortened.length !== 8) fail(`expected 8 messages (system + summary + 6), got ${shortened.length}`)
  if (shortened[0].content !== 'sys') fail('system message was not kept verbatim')
  if (shortened[1].role !== 'system' || !String(shortened[1].content).startsWith('[compaction]')) {
    fail(`message[1] is not the summary: ${JSON.stringify(shortened[1]).slice(0, 120)}`)
  }
  const expectedTail = big.slice(-6)
  for (let i = 0; i < 6; i++) {
    if (shortened[2 + i] !== expectedTail[i]) fail(`newest-6 tail mismatch at ${i}`)
  }
  const after = contextWindow.estimateTokens(shortened)
  if (!(after < bigTokens)) fail(`compaction did not shrink tokens: ${bigTokens} -> ${after}`)

  console.log(
    `[check-compaction] ok via ${dispatch}: ${bigTokens} -> ${after} tokens, ${big.length} -> ${shortened.length} messages`,
  )
}

function returnsNothing(result) {
  if (result == null) return true
  const values = Array.isArray(result) ? result : [result]
  return values.every((v) => v === undefined || v === null)
}

function pickArray(result) {
  if (isMessages(result)) return result
  const values = Array.isArray(result) ? result : [result]
  for (const v of values) if (isMessages(v)) return v
  return null
}

function isMessages(value) {
  return Array.isArray(value) && value.every((m) => m && typeof m === 'object' && 'role' in m)
}
