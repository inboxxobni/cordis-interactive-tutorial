export const name = 'context-window'

const CHARS_PER_TOKEN = 4

/**
 * Flatten a message's content to a string, whatever shape it takes:
 * plain string, array of content parts ({type:'text', text}), or an
 * assistant message that only carries tool_calls.
 */
function contentToText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        return ''
      })
      .join('')
  }
  if (typeof content === 'object') {
    // tool_calls and anything else structured: count its serialized size.
    try {
      return JSON.stringify(content)
    } catch {
      return ''
    }
  }
  return String(content)
}

function messageToText(message) {
  if (message == null) return ''
  if (typeof message === 'string') return message
  const parts = [contentToText(message.content)]
  if (message.tool_calls) parts.push(contentToText(message.tool_calls))
  if (typeof message.name === 'string') parts.push(message.name)
  return parts.join('\n')
}

export class ContextWindow {
  /**
   * Rough token estimate: total characters / 4. Deliberately cheap and
   * approximate - good enough to decide when to compact, never exact.
   */
  estimateTokens(messages) {
    const list = Array.isArray(messages) ? messages : []
    let chars = 0
    for (const message of list) chars += messageToText(message).length
    return Math.ceil(chars / CHARS_PER_TOKEN)
  }

  /**
   * How many leading messages are identical between two message arrays.
   * Comparison is on the serialized message, so a rewritten message ends
   * the shared prefix right there - that boundary is exactly what a
   * compaction/caching layer needs to know what it may keep.
   */
  sharedPrefixLength(previous, current) {
    const a = Array.isArray(previous) ? previous : []
    const b = Array.isArray(current) ? current : []
    const max = Math.min(a.length, b.length)
    let i = 0
    while (i < max && serialize(a[i]) === serialize(b[i])) i++
    return i
  }
}

function serialize(message) {
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

export function apply(ctx) {
  ctx.provide('contextWindow', new ContextWindow())
  console.log('[context-window] active - provided contextWindow')
}
