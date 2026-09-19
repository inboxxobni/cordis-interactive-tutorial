/**
 * DeepSeek's chat API is OpenAI-compatible: POST {baseURL}/chat/completions.
 * Canonical (Anthropic-style) messages are converted to that shape here, and
 * streamed tool-call fragments are reassembled into whole calls.
 */
import type { ContentBlock, LLMResponse, Message, ProviderConfig, TextBlock, ToolCall, ToolDefinition, ToolResultBlock, ToolUseBlock } from '@cordis-tutorial/shared'
import { parseSSE, tryJson, type LLMProvider } from './types.js'

interface OpenAIToolCallDelta {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

function toOpenAIMessage(m: Message): Record<string, unknown>[] {
  if (m.role === 'system') {
    return [{ role: 'system', content: typeof m.content === 'string' ? m.content : blockText(m.content) }]
  }
  if (typeof m.content === 'string') {
    return [{ role: m.role, content: m.content }]
  }
  if (m.role === 'assistant') {
    const blocks = m.content
    const texts = blocks.filter((b): b is TextBlock => b.type === 'text')
    const toolUses = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    const out: Record<string, unknown> = { role: 'assistant', content: texts.length ? texts.map((t) => t.text).join('') : null }
    if (toolUses.length) {
      out.tool_calls = toolUses.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.input) } }))
    }
    return [out]
  }
  const toolResults = m.content.filter((b): b is ToolResultBlock => b.type === 'tool_result')
  if (toolResults.length) {
    return toolResults.map((r) => ({ role: 'tool', tool_call_id: r.tool_use_id, content: r.content }))
  }
  return [{ role: m.role, content: blockText(m.content) }]
}

function blockText(blocks: ContentBlock[]): string {
  return blocks.filter((b): b is TextBlock => b.type === 'text').map((b) => b.text).join('')
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string
  readonly model: string
  readonly baseURL: string
  private readonly apiKey: string

  constructor(config: ProviderConfig) {
    this.id = config.provider
    this.model = config.model
    this.apiKey = config.apiKey
    this.baseURL = (config.baseURL || '').replace(/\/$/, '')
  }

  async chat(messages: Message[], tools: ToolDefinition[], onDelta?: (text: string) => void, signal?: AbortSignal): Promise<LLMResponse> {
    const url = /\/chat\/completions$/.test(this.baseURL) ? this.baseURL : `${this.baseURL}/chat/completions`
    const payload = {
      model: this.model,
      messages: messages.flatMap(toOpenAIMessage),
      tools: tools.length === 0 ? undefined : tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
      tool_choice: tools.length === 0 ? undefined : 'auto',
      stream: true,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`${this.id} API error ${res.status}: ${detail.slice(0, 500)}`)
    }

    let text = ''
    let stopReason = 'stop'
    const callMap = new Map<number, { id: string; name: string; args: string }>()
    let usage: { input_tokens: number; output_tokens: number; cacheHitTokens?: number; cacheMissTokens?: number } = { input_tokens: 0, output_tokens: 0 }

    for await (const data of parseSSE(res)) {
      const chunk = tryJson<{
        choices?: Array<{ delta?: { content?: string; tool_calls?: OpenAIToolCallDelta[] }; finish_reason?: string | null }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          // DeepSeek's real field names - its prompt caching is on by
          // default, no opt-in, and reported on every response.
          prompt_cache_hit_tokens?: number
          prompt_cache_miss_tokens?: number
          // Some other OpenAI-compatible providers report an equivalent this way instead.
          prompt_tokens_details?: { cached_tokens?: number }
        }
      }>(data)
      if (!chunk) continue
      const choice = chunk.choices?.[0]
      if (choice?.delta?.content) {
        text += choice.delta.content
        onDelta?.(choice.delta.content)
      }
      for (const tc of choice?.delta?.tool_calls ?? []) {
        const existing = callMap.get(tc.index) ?? { id: '', name: '', args: '' }
        if (tc.id) existing.id = tc.id
        if (tc.function?.name) existing.name = tc.function.name
        if (tc.function?.arguments) existing.args += tc.function.arguments
        callMap.set(tc.index, existing)
      }
      if (choice?.finish_reason) stopReason = choice.finish_reason
      if (chunk.usage) {
        const cachedFromDetails = chunk.usage.prompt_tokens_details?.cached_tokens
        usage = {
          input_tokens: chunk.usage.prompt_tokens ?? 0,
          output_tokens: chunk.usage.completion_tokens ?? 0,
          cacheHitTokens: chunk.usage.prompt_cache_hit_tokens ?? cachedFromDetails,
          cacheMissTokens: chunk.usage.prompt_cache_miss_tokens ?? (cachedFromDetails !== undefined ? (chunk.usage.prompt_tokens ?? 0) - cachedFromDetails : undefined),
        }
      }
    }

    const toolCalls: ToolCall[] = []
    for (const [, c] of callMap) {
      let input: Record<string, unknown> = {}
      if (c.args) {
        const parsed = tryJson<Record<string, unknown>>(c.args)
        if (parsed) input = parsed
      }
      toolCalls.push({ id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`, name: c.name, input })
    }

    return { text, toolCalls, stopReason: stopReason === 'tool_calls' ? 'tool_use' : stopReason, usage, raw: { url, model: this.model, text, toolCalls } }
  }
}
