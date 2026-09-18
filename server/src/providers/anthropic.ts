/**
 * Anthropic (Claude) Messages API provider. POST {baseURL}/messages,
 * stream:true. Ported from aicodingagent-ts/server/src/providers/anthropic.ts.
 */
import type { ContentBlock, LLMResponse, Message, ProviderConfig, TextBlock, ToolCall, ToolDefinition } from '@cordis-tutorial/shared'
import { parseSSE, tryJson, type LLMProvider } from './types.js'

export class AnthropicProvider implements LLMProvider {
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
    const url = /\/messages$/.test(this.baseURL) ? this.baseURL : `${this.baseURL}/messages`

    const systemMsg = messages.find((m) => m.role === 'system')
    const systemText = systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg ? blockText(systemMsg.content as ContentBlock[]) : undefined

    const apiMessages = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))

    const payload: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      stream: true,
      messages: apiMessages,
      tools: tools.length === 0 ? undefined : tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    }
    if (systemText) payload.system = systemText

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 500)}`)
    }

    let text = ''
    let stopReason = 'end_turn'
    let usage = { input_tokens: 0, output_tokens: 0 }
    const toolBuffers = new Map<number, { id: string; name: string; json: string }>()
    let currentToolIndex: number | null = null

    for await (const data of parseSSE(res)) {
      const evt = tryJson<{
        type: string
        index?: number
        content_block?: { type: string; id?: string; name?: string }
        delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string }
        message?: { usage?: { input_tokens?: number; output_tokens?: number } }
        usage?: { input_tokens?: number; output_tokens?: number }
      }>(data)
      if (!evt) continue

      switch (evt.type) {
        case 'content_block_start':
          if (evt.content_block?.type === 'tool_use' && evt.index != null) {
            toolBuffers.set(evt.index, { id: evt.content_block.id || '', name: evt.content_block.name || '', json: '' })
            currentToolIndex = evt.index
          }
          break
        case 'content_block_delta':
          if (evt.delta?.type === 'text_delta' && evt.delta.text) {
            text += evt.delta.text
            onDelta?.(evt.delta.text)
          } else if (evt.delta?.type === 'input_json_delta' && evt.delta.partial_json && currentToolIndex != null) {
            const buf = toolBuffers.get(currentToolIndex)
            if (buf) buf.json += evt.delta.partial_json
          }
          break
        case 'content_block_stop':
          currentToolIndex = null
          break
        case 'message_delta':
          if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason
          if (evt.usage) usage = { input_tokens: usage.input_tokens, output_tokens: evt.usage.output_tokens ?? usage.output_tokens }
          break
        case 'message_start':
          if (evt.message?.usage) usage = { input_tokens: evt.message.usage.input_tokens ?? 0, output_tokens: evt.message.usage.output_tokens ?? 0 }
          break
      }
    }

    const toolCalls: ToolCall[] = []
    for (const [, buf] of toolBuffers) {
      let input: Record<string, unknown> = {}
      if (buf.json) {
        const parsed = tryJson<Record<string, unknown>>(buf.json)
        if (parsed) input = parsed
      }
      toolCalls.push({ id: buf.id || `toolu_${Math.random().toString(36).slice(2, 10)}`, name: buf.name, input })
    }

    return { text, toolCalls, stopReason, usage, raw: { url, model: this.model, text, toolCalls } }
  }
}

function blockText(blocks: ContentBlock[]): string {
  return blocks.filter((b): b is TextBlock => b.type === 'text').map((b) => b.text).join('')
}
