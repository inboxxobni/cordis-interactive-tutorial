/**
 * The `compaction` plugin - Volume 2, chapter 20. Ports aicodingagent-ts's
 * compactMessages() (not present anywhere in this repo before now) and
 * hooks it to a real Cordis event instead of a manual /compact command:
 * agent-loop dispatches `ctx.serial('agent-harness/compact', ...)` before
 * every LLM call (the exact real dispatch mode chapter 4 already teaches -
 * first non-null/false/undefined listener return wins). This listener only
 * returns a replacement message array once the estimated token count
 * crosses a threshold - otherwise it returns nothing and the loop's own
 * messages are left untouched. Mirrors DeepSeek Harness's real
 * `compaction-basic` package: one pressure check, one summarization pass,
 * nothing else.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Message } from '@cordis-tutorial/shared'

// Cordis types every event through declaration merging on its own `Events`
// interface (see chapter 4's own tutorial/greeting for the same pattern) -
// serial dispatch here matches chapter 4's real "first non-null/false/
// undefined listener return wins" semantics, applied to a real decision:
// does anything want to compact the messages right now?
declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent-harness/compact'(payload: { messages: Message[]; estimatedTokens: number }): Message[] | undefined
  }
}

const KEEP_RECENT = 6
const TOKEN_THRESHOLD = 6000

function describe(message: Message): string {
  if (typeof message.content === 'string') return message.content
  return message.content
    .map((block) => {
      if (block.type === 'text') return block.text
      if (block.type === 'tool_use') return `tool_use ${block.name}(${JSON.stringify(block.input)})`
      return `tool_result ${block.content}`
    })
    .join(' ')
}

export function compactMessages(messages: Message[], keepRecent = KEEP_RECENT): { messages: Message[]; removedCount: number } {
  const system = messages[0]?.role === 'system' ? messages[0] : undefined
  const start = system ? 1 : 0
  const removable = Math.max(0, messages.length - start - keepRecent)
  if (removable === 0) return { messages: [...messages], removedCount: 0 }

  const older = messages.slice(start, start + removable)
  const recent = messages.slice(start + removable)
  const summary = older.map((m) => `- ${m.role}: ${describe(m).slice(0, 240)}`).join('\n')
  const compacted: Message = {
    role: 'user',
    content: `[COMPACTED CONTEXT]\nThis deterministic summary replaces ${older.length} earlier messages.\n${summary}`,
  }
  return { messages: [...(system ? [system] : []), compacted, ...recent], removedCount: older.length }
}

export function mountCompaction(ctx: Context) {
  return ctx.plugin({
    name: 'agent-harness-compaction',
    apply(pluginCtx: Context) {
      pluginCtx.on(
        'agent-harness/compact',
        (payload: { messages: Message[]; estimatedTokens: number }) => {
          if (payload.estimatedTokens < TOKEN_THRESHOLD) return undefined
          return compactMessages(payload.messages).messages
        },
      )
    },
  })
}
