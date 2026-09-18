import type { Message } from '@cordis-tutorial/shared'

/** Messages qualify for prefix caching only while their serialized bytes match. */
export function sharedPrefixLength(previous: readonly Message[], current: readonly Message[]): number {
  let index = 0
  while (index < previous.length && index < current.length && JSON.stringify(previous[index]) === JSON.stringify(current[index])) {
    index += 1
  }
  return index
}

function estimateTokens(messages: Message[]): number {
  let chars = 0
  for (const m of messages) {
    if (typeof m.content === 'string') {
      chars += m.content.length
    } else {
      for (const b of m.content) {
        if (b.type === 'text') chars += b.text.length
        else if (b.type === 'tool_use') chars += JSON.stringify(b.input).length + b.name.length
        else if (b.type === 'tool_result') chars += b.content.length
      }
    }
  }
  return Math.ceil(chars / 4)
}

export { estimateTokens }
