export const name = 'context-window'

// Rough, provider-agnostic accounting. Real tokenizers vary, but for deciding
// "have we outgrown the window?" a chars/4 estimate is stable and free - and
// crucially it is monotonic: appending a message never lowers the number.

function sizeOf(value) {
  if (value == null) return 0
  if (typeof value === 'string') return value.length
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

// Per-message overhead the provider adds for role/name/tool framing.
const MESSAGE_OVERHEAD = 4

function tokensIn(message) {
  if (message == null || typeof message !== 'object') return sizeOf(message)

  let chars = sizeOf(message.role) + sizeOf(message.content) + sizeOf(message.name) + sizeOf(message.toolCallId)
  chars += sizeOf(message.toolCalls)

  return MESSAGE_OVERHEAD + Math.ceil(chars / 4)
}

// Canonical form used for "byte-identical" message comparison. Key order is
// fixed by construction, so serializing is a faithful, cheap equality test.
function canonical(message) {
  if (message == null || typeof message !== 'object') return JSON.stringify(message)
  return JSON.stringify({
    role: message.role ?? null,
    content: message.content ?? null,
    name: message.name ?? null,
    toolCallId: message.toolCallId ?? null,
    toolCalls: message.toolCalls ?? null,
  })
}

const service = {
  /** Rough token estimate for a whole message array (chars/4, plus framing). */
  estimateTokens(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return 0
    let total = 0
    for (const message of messages) total += tokensIn(message)
    return total
  },

  /**
   * How many leading messages are identical between two arrays. This is the
   * cache-reuse primitive: N shared leading messages means the provider can
   * reuse N messages of prefix, so only the tail needs reprocessing.
   */
  sharedPrefixLength(previous, current) {
    if (!Array.isArray(previous) || !Array.isArray(current)) return 0

    const limit = Math.min(previous.length, current.length)
    let i = 0
    while (i < limit) {
      if (previous[i] === current[i]) {
        i++
        continue
      }
      if (canonical(previous[i]) !== canonical(current[i])) break
      i++
    }
    return i
  },

  /** Convenience: is this array over the given token budget? */
  overBudget(messages, limit) {
    return service.estimateTokens(messages) > limit
  },
}

export function apply(ctx) {
  ctx.provide('contextWindow', service)
}
