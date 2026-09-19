import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'compaction'

// Real dependency: token estimates come from the contextWindow service.
// Until that exists this fiber stays PENDING, which is correct behaviour.
export const inject = ['contextWindow']

const DIR = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_THRESHOLD = 6000
const DEFAULT_KEEP_NEWEST = 6
const SUMMARY_CHARS = 240

/** Rough fallback if contextWindow is not resolvable for some reason. */
function fallbackTokens(messages) {
  const list = Array.isArray(messages) ? messages : []
  let chars = 0
  for (const m of list) {
    chars += typeof m?.content === 'string' ? m.content.length : JSON.stringify(m ?? '').length
  }
  return Math.ceil(chars / 4)
}

function isSystemMessage(message) {
  return message?.role === 'system' || message?.role === 'developer'
}

function oneLine(message) {
  const text = typeof message?.content === 'string'
    ? message.content
    : JSON.stringify(message?.content ?? '')
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > SUMMARY_CHARS ? `${flat.slice(0, SUMMARY_CHARS)}…` : flat
}

function summarize(dropped) {
  if (dropped.length === 0) return '(nothing dropped)'
  const lines = dropped.map((m, i) => `  ${i + 1}. [${m?.role ?? 'unknown'}] ${oneLine(m)}`)
  return `[compacted ${dropped.length} older message(s)]\n${lines.join('\n')}`
}

export function apply(ctx, config = {}) {
  // Cordis passes the mount config as apply()'s second argument; ctx.config
  // requires its own inject declaration, so use the parameter.
  const threshold = Number(config.threshold) || DEFAULT_THRESHOLD
  const keepNewest = Number(config.keepNewest) || DEFAULT_KEEP_NEWEST

  /**
   * Pure transform: keep every system message plus the newest `keepNewest`
   * messages, and collapse everything in between into a single summary
   * message. Returns null when there is nothing worth compacting.
   */
  function compactMessages(messages, options = {}) {
    if (!Array.isArray(messages)) return null
    const keep = Number(options.keepNewest) || keepNewest

    const system = messages.filter(isSystemMessage)
    const rest = messages.filter((m) => !isSystemMessage(m))
    if (rest.length <= keep) return null

    const dropped = rest.slice(0, rest.length - keep)
    const newest = rest.slice(rest.length - keep)
    if (dropped.length === 0) return null

    const summary = { role: 'user', content: summarize(dropped) }
    return [...system, summary, ...newest]
  }

  const compaction = {
    // marker/service identity
    name: 'compaction',
    threshold,
    keepNewest,
    workspace: DIR,

    /** Estimated tokens via the real contextWindow service. */
    estimateTokens(messages) {
      try {
        return ctx.contextWindow.estimateTokens(messages)
      } catch {
        return fallbackTokens(messages)
      }
    },

    /** Should this message array be compacted? */
    shouldCompact(messages, tokens) {
      return (tokens ?? this.estimateTokens(messages)) >= threshold
    },

    /** Direct API mirroring the event, for code that would rather call than emit. */
    compact(messages, options = {}) {
      const limit = options.threshold ?? threshold
      const tokens = this.estimateTokens(messages)
      if (tokens < limit) return { compacted: false, tokens, messages }
      const next = compactMessages(messages, options)
      if (!next) return { compacted: false, tokens, messages }
      return {
        compacted: true,
        tokens,
        tokensAfter: this.estimateTokens(next),
        dropped: messages.length - next.length + 1,
        messages: next,
      }
    },
  }

  ctx.provide('compaction', compaction)

  // Real Cordis event listener, serial dispatch. Returning a value bails out
  // of the dispatch chain; returning undefined means "I have nothing to add".
  ctx.effect(() => ctx.on('agent-harness/compact', (payload = {}) => {
    const messages = payload.messages ?? payload.history
    if (!Array.isArray(messages)) return undefined

    const tokens = payload.estimatedTokens ?? payload.tokens ?? compaction.estimateTokens(messages)
    if (tokens < (payload.threshold ?? threshold)) return undefined

    const next = compactMessages(messages, payload)
    if (!next) return undefined

    ctx.logger?.info?.(
      '[compaction] %d messages / ~%d tokens -> %d messages / ~%d tokens',
      messages.length,
      tokens,
      next.length,
      compaction.estimateTokens(next),
    )
    return next
  }))

  ctx.logger?.info?.(
    '[compaction] providing compaction (threshold %d tokens, keep newest %d)',
    threshold,
    keepNewest,
  )
  ctx.effect(() => () => ctx.logger?.info?.('[compaction] disposed'))
}

export default { name, inject, apply }
