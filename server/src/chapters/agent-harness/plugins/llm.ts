/**
 * The `llm` service - Volume 2, chapter 22. Wraps whatever provider is
 * already configured in Settings (session.providerConfig, resolved live via
 * instr.getProviderConfig()) with the tutorial's own already-working
 * createProvider() - the exact same DeepSeek/OpenAI/Anthropic/etc adapters
 * the outer meta-agent already uses. No new provider code, no new UI: this
 * is the one dependency that, once mounted, finally lets agent-loop's
 * fiber leave PENDING.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { LLMResponse, Message, ToolDefinition } from '@cordis-tutorial/shared'
import type { Instrumented } from '../../../cordis-instrumentation.js'
import { createProvider } from '../../../providers/types.js'

export interface LlmService {
  chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse>
}

export function mountLlm(ctx: Context, instr: Instrumented) {
  return ctx.plugin({
    name: 'agent-harness-llm',
    apply(pluginCtx: Context) {
      const service: LlmService = {
        async chat(messages, tools) {
          const config = instr.getProviderConfig()
          if (!config) {
            throw new Error('No provider configured yet - open Settings and configure one first.')
          }
          const provider = createProvider(config)
          return provider.chat(messages, tools)
        },
      }
      pluginCtx.provide('llm', service)
    },
  })
}
