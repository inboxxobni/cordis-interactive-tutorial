export const name = 'compaction'
export const inject = ['contextWindow']

const TOKEN_THRESHOLD = 6000
const KEEP_NEWEST = 6
const SUMMARY_CHARS = 400

/** The event may hand us the payload as the sole arg (variadic dispatch) or
 *  as args[0] of an array (args-array dispatch) - accept both, that is the
 *  one place the two real dispatch shapes differ. */
function firstArg(payload) {
  return Array.isArray(payload) ? payload[0] ?? {} : payload ?? {}
}

function describe(message) {
  if (message == null) return '?'
  const role = message.role ?? '?'
  const calls = message.tool_calls
  if (Array.isArray(calls) && calls.length) {
    const names = calls.map((c) => c?.function?.name ?? c?.name ?? '?').join(', ')
    return `${role} (called ${names})`
  }
  return role
}

/**
 * Pure: old messages -> one summary message. Kept trivial so its output is
 * predictable and testable.
 */
function summarize(dropped) {
  const outline = dropped.map(describe).join('; ')
  const body = outline.length > SUMMARY_CHARS ? `${outline.slice(0, SUMMARY_CHARS)}…` : outline
  return {
    role: 'system',
    content:
      `[compaction] ${dropped.length} earlier message(s) elided to stay within the ` +
      `context window. Outline of what was dropped: ${body}`,
  }
}

export class Compaction {
  constructor(ctx) {
    this.ctx = ctx
    this.threshold = TOKEN_THRESHOLD
    this.keepNewest = KEEP_NEWEST
    // Observability for real verification: how many times the event listener
    // actually ran, and the size of its last non-empty result.
    this.hits = 0
    this.lastResultLength = null
  }

  /**
   * Returns a shortened messages array when the context is over budget,
   * otherwise undefined (meaning: nothing to change, keep the original).
   */
  compact(payload) {
    this.hits++
    const { messages, estimatedTokens } = firstArg(payload)
    const list = Array.isArray(messages) ? messages : Array.isArray(payload) ? payload : []
    if (list.length === 0) return

    const tokens =
      typeof estimatedTokens === 'number' ? estimatedTokens : this.ctx.contextWindow.estimateTokens(list)
    if (tokens < this.threshold) return

    // Keep the leading system message(s) verbatim, always.
    let headLength = 0
    while (headLength < list.length && list[headLength]?.role === 'system') headLength++
    const head = list.slice(0, headLength)
    const rest = list.slice(headLength)

    const dropped = rest.slice(0, Math.max(0, rest.length - this.keepNewest))
    if (dropped.length === 0) return

    return [...head, summarize(dropped), ...rest.slice(-this.keepNewest)]
  }
}
export function apply(ctx) {
  const compaction = new Compaction(ctx)
  ctx.provide('compaction', compaction)

  ctx.on('agent-harness/compact', (payload) => {
    const result = compaction.compact(payload)
    compaction.lastResultLength = result ? result.length : null
    return result
  })

  console.log(
    `[compaction] active - provides compaction, listening on agent-harness/compact (threshold ${TOKEN_THRESHOLD} tokens, keep newest ${KEEP_NEWEST})`,
  )
}
