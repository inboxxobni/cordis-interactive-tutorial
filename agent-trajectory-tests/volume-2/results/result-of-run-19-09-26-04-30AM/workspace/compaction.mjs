import { Service } from '@deepseek-ai/cordis'

export const name = 'compaction'
export const inject = ['contextWindow']

// Over this estimate, the history is worth shortening. Uses contextWindow's
// estimator rather than a local char count, so the threshold means the same
// thing everywhere in the harness.
const TOKEN_LIMIT = 6000
const KEEP_NEWEST = 6

export default class Compaction extends Service {
  static inject = inject

  constructor(ctx) {
    super(ctx, 'compaction')
  }

  /**
   * Decide whether a message array needs compacting, and if so return the
   * shortened array. Returns undefined when nothing should change - which is
   * the honest answer: "I have no opinion, keep what you have" rather than
   * handing back an identical copy the caller has to diff.
   */
  compact(messages, estimatedTokens) {
    if (!Array.isArray(messages) || messages.length === 0) return undefined

    const tokens = typeof estimatedTokens === 'number'
      ? estimatedTokens
      : this.ctx.contextWindow.estimateTokens(messages)

    if (tokens <= TOKEN_LIMIT) return undefined

    // The system prompt carries the agent's identity, tools and rules - it is
    // never droppable. Only conversation history is eligible.
    const system = messages.filter((m) => m.role === 'system')
    const rest = messages.filter((m) => m.role !== 'system')

    const dropCount = rest.length - KEEP_NEWEST
    if (dropCount <= 0) return undefined

    const older = rest.slice(0, dropCount)
    const newest = rest.slice(dropCount)

    const summary = {
      role: 'system',
      name: 'compaction',
      content:
        `[summary of earlier conversation] ${older.length} older message(s) compacted ` +
        `(~${tokens} estimated tokens before compaction, limit ${TOKEN_LIMIT}).`,
    }

    return [...system, summary, ...newest]
  }
}

export function apply(ctx) {
  const compaction = new Compaction(ctx)

  // Serial dispatch via ctx.on: handlers on this event run in order, one at a
  // time, so compaction can't interleave with another rewrite of the same
  // history. Registration is owned by this fiber - unmounting removes it.
  ctx.on('agent-harness/compact', (payload) => {
    if (!payload) return undefined
    return compaction.compact(payload.messages, payload.estimatedTokens)
  })
}
