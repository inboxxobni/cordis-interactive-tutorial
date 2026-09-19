// context-window.mjs - the budget service: how big is the transcript, and how
// much of it is unchanged since last time.
//
// Provides: contextWindow -> ctx.contextWindow.estimateTokens(messages)
//                            ctx.contextWindow.sharedPrefixLength(prev, cur)
// Injects:  nothing (ACTIVE the moment it is mounted)
//
// Deliberately cheap and approximate: chars/4 is good enough to decide WHEN to
// compact, and never exact. No timers/listeners here, so nothing outlives
// apply() and no ctx.effect() is needed.
export const name = 'context-window'

/** Rough, provider-agnostic ratio. ~4 characters per token. */
const CHARS_PER_TOKEN = 4

/** Flatten any content shape (string | parts[] | structured) to text. */
function contentToText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : (part?.text ?? '')))
      .join('')
  }
  return stringify(content)
}

/** All the bytes a message contributes to the prompt. */
function messageToText(message) {
  if (message == null) return ''
  if (typeof message === 'string') return message
  const parts = [contentToText(message.content)]
  // Assistant tool calls and the tool name are real prompt payload too.
  if (message.tool_calls) parts.push(stringify(message.tool_calls))
  if (message.name) parts.push(String(message.name))
  return parts.join('\n')
}

function stringify(value) {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

export class ContextWindow {
  /**
   * Estimate the token cost of a transcript.
   *
   * @param {Array} messages - OpenAI-shaped message array.
   * @returns {number} estimated tokens, rounded up.
   */
  estimateTokens(messages) {
    const list = Array.isArray(messages) ? messages : [messages]
    let chars = 0
    for (const message of list) chars += messageToText(message).length
    return Math.ceil(chars / CHARS_PER_TOKEN)
  }

  /**
   * Count leading messages that are byte-identical between two transcripts.
   *
   * Comparison is on serialized bytes, so one rewritten character ends the
   * shared prefix exactly there. That boundary is what a compaction or
   * prompt-cache layer needs: everything before it can be reused, everything
   * from it on must be re-sent.
   *
   * @returns {number} length of the identical leading run.
   */
  sharedPrefixLength(previous, current) {
    const a = Array.isArray(previous) ? previous : []
    const b = Array.isArray(current) ? current : []
    let i = 0
    const max = Math.min(a.length, b.length)
    while (i < max && bytesEqual(a[i], b[i])) i++
    return i
  }
}

function bytesEqual(x, y) {
  if (x === y) return true
  return Buffer.from(stringify(x), 'utf8').equals(Buffer.from(stringify(y), 'utf8'))
}

export function apply(ctx) {
  ctx.provide('contextWindow', new ContextWindow())
  console.log('[context-window] active - provided contextWindow (estimateTokens, sharedPrefixLength)')
}
