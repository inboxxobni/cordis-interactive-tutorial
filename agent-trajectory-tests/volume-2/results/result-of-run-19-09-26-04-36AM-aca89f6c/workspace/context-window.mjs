import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'context-window'

const DIR = path.dirname(fileURLToPath(import.meta.url))

const CHARS_PER_TOKEN = 4

/** Every field of a message that actually reaches the model as text. */
function messageText(message) {
  if (message == null) return ''
  if (typeof message === 'string') return message
  const parts = []
  const push = (value) => {
    if (value == null) return
    if (typeof value === 'string') parts.push(value)
    else parts.push(JSON.stringify(value))
  }
  push(message.role)
  push(message.content)
  push(message.name)
  push(message.tool_call_id)
  push(message.tool_calls ?? message.toolCalls)
  return parts.join(' ')
}

/**
 * Canonical serialization: object keys are sorted so two messages that differ
 * only in key insertion order still compare as identical.
 */
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
}

const contextWindow = {
  charsPerToken: CHARS_PER_TOKEN,
  workspace: DIR,

  /** Rough token estimate for a message array: total characters / 4, rounded up. */
  estimateTokens(messages) {
    const list = Array.isArray(messages) ? messages : messages == null ? [] : [messages]
    let chars = 0
    for (const message of list) chars += messageText(message).length
    return Math.ceil(chars / CHARS_PER_TOKEN)
  },

  /** Character count estimateTokens is derived from - handy for debugging. */
  estimateChars(messages) {
    const list = Array.isArray(messages) ? messages : messages == null ? [] : [messages]
    let chars = 0
    for (const message of list) chars += messageText(message).length
    return chars
  },

  /**
   * Number of leading messages that are byte-identical (canonically) between
   * two arrays. Returns 0 if either input is not an array, and stops at the
   * first differing message or at the end of the shorter array.
   */
  sharedPrefixLength(previous, current) {
    if (!Array.isArray(previous) || !Array.isArray(current)) return 0
    const limit = Math.min(previous.length, current.length)
    let n = 0
    while (n < limit && canonical(previous[n]) === canonical(current[n])) n++
    return n
  },

  /**
   * How much of `current` is new relative to `previous`, in messages and
   * estimated tokens - the numbers a compaction policy wants.
   */
  diff(previous, current) {
    const shared = contextWindow.sharedPrefixLength(previous, current)
    const list = Array.isArray(current) ? current : []
    const suffix = list.slice(shared)
    return {
      sharedPrefixLength: shared,
      totalMessages: list.length,
      newMessages: suffix.length,
      newTokens: contextWindow.estimateTokens(suffix),
      totalTokens: contextWindow.estimateTokens(list),
    }
  },
}

export function apply(ctx) {
  ctx.provide('contextWindow', contextWindow)
  ctx.logger?.info?.(
    '[context-window] providing contextWindow (≈%d chars/token), workspace %s',
    CHARS_PER_TOKEN,
    DIR,
  )
  ctx.effect(() => () => ctx.logger?.info?.('[context-window] disposed'))
}

export default { name, apply }
