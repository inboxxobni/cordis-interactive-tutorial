// compaction.mjs - the context-budget enforcement point.
//
// Provides: compaction (service identity, so consumers can inject it by name)
// Injects:  contextWindow
// Listens:  'agent-harness/compact' - a SERIAL event.
//
// Serial semantics matter here: listeners run in registration order and are
// awaited, and the first return value that is not null/false/undefined ends the
// dispatch. So returning `undefined` means "no opinion, let the next listener
// decide", and returning an array means "here is the transcript to use".
//
// The listener is registered with ctx.on, which makes it an EFFECT of this
// Fiber: Cordis removes it automatically when this plugin unloads. No manual
// cleanup is written, on purpose.
import { Service } from '@deepseek-ai/cordis'

export const name = 'compaction'
export const inject = ['contextWindow']

/** Compact once the estimated transcript cost crosses this. */
const TOKEN_THRESHOLD = 6000
/** How many of the newest messages survive verbatim. */
const KEEP_NEWEST = 6
/** Cap the outline text that replaces the dropped messages. */
const OUTLINE_CHARS = 400

const EVENT = 'agent-harness/compact'

/**
 * Serial dispatch spreads the arguments, so the payload is args[0]. Accept the
 * object form `{ messages, estimatedTokens }`; a bare transcript array is also
 * understood, since that is the one other shape a caller might hand us.
 */
function normalize(args) {
  const payload = Array.isArray(args) ? args[0] : args
  if (Array.isArray(payload)) return { messages: payload }
  return payload ?? {}
}

function label(message) {
  if (message == null) return '?'
  const role = message.role ?? '?'
  const calls = message.tool_calls
  if (Array.isArray(calls) && calls.length) {
    const names = calls.map((c) => c?.function?.name ?? c?.name ?? '?').join(', ')
    return `${role} (called ${names})`
  }
  return role
}

/** Pure: the dropped messages become ONE summary message. */
function summarize(dropped) {
  const outline = dropped.map(label).join('; ')
  return {
    role: 'system',
    content:
      `[compaction] ${dropped.length} earlier message(s) elided to stay within the context window. ` +
      `Outline: ${outline.length > OUTLINE_CHARS ? `${outline.slice(0, OUTLINE_CHARS)}…` : outline}`,
  }
}

export class Compaction extends Service {
  constructor(ctx) {
    super(ctx, 'compaction')

    this.threshold = TOKEN_THRESHOLD
    this.keepNewest = KEEP_NEWEST

    // Real observability: the listener increments these, so an outside caller
    // can tell whether compaction actually ran and what it produced.
    this.hits = 0
    this.lastResult = null

    // Owned by this Fiber - auto-removed on unload.
    ctx.on(EVENT, (...args) => {
      const result = this.compact(normalize(args))
      this.lastResult = result ?? null
      return result
    })

    console.log(
      `[compaction] active - listening on ${EVENT} (threshold ${TOKEN_THRESHOLD}, keep newest ${KEEP_NEWEST})`,
    )
  }

  /**
   * @param {{ messages?: Array, estimatedTokens?: number }} payload
   * @returns {Array|undefined} shortened transcript, or undefined to decline.
   */
  compact({ messages, estimatedTokens } = {}) {
    this.hits++

    const list = Array.isArray(messages) ? messages : []
    if (list.length === 0) return

    const tokens =
      typeof estimatedTokens === 'number'
        ? estimatedTokens
        : this.ctx.contextWindow.estimateTokens(list)

    if (tokens < this.threshold) return

    // The leading system message(s) are always kept verbatim.
    let headLength = 0
    while (headLength < list.length && list[headLength]?.role === 'system') headLength++

    const head = list.slice(0, headLength)
    const rest = list.slice(headLength)

    const dropped = rest.slice(0, Math.max(0, rest.length - this.keepNewest))
    if (dropped.length === 0) return

    return [...head, summarize(dropped), ...rest.slice(-this.keepNewest)]
  }
}

export { Compaction as apply }
