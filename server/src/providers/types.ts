/**
 * LLM provider abstraction. Raw fetch + SSE (no SDK) so the visualizer can
 * show the exact request. openai/deepseek/byteplus/qwen/ollama/lmstudio all
 * speak the OpenAI-compatible chat/completions wire format; anthropic (and
 * byteplus's Coding-plan endpoint, which is Anthropic-shaped) use the
 * Messages API adapter.
 */
import type { LLMResponse, Message, ProviderConfig, ToolDefinition } from '@cordis-tutorial/shared'
import { OpenAICompatibleProvider } from './openai.js'
import { AnthropicProvider } from './anthropic.js'

export interface LLMProvider {
  readonly id: string
  readonly model: string
  readonly baseURL: string
  chat(messages: Message[], tools: ToolDefinition[], onDelta?: (text: string) => void, signal?: AbortSignal): Promise<LLMResponse>
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
    case 'deepseek':
    case 'ollama':
    case 'lmstudio':
    case 'qwen':
      return new OpenAICompatibleProvider(config)
    case 'byteplus':
    case 'anthropic':
      return new AnthropicProvider(config)
    default: {
      const _exhaustive: never = config.provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

export async function* parseSSE(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        const trimmed = line.trim()
        if (trimmed === '' || trimmed.startsWith(':')) continue
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return
          yield data
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function tryJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}
