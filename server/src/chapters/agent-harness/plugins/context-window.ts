/**
 * The `contextWindow` service - Volume 2, chapter 19. A real Cordis service
 * wrapping the tutorial's own already-working sharedPrefixLength()/
 * estimateTokens() (server/src/context.ts, itself ported verbatim from
 * aicodingagent-ts) - the same two pure functions that already drive the
 * "cacheable vs new" distinction there, now exposed as ctx.contextWindow so
 * agent-loop (chapter 17) can call them without importing them directly -
 * a real dependency, not a convenience re-export.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Message } from '@cordis-tutorial/shared'
import { sharedPrefixLength, estimateTokens } from '../../../context.js'

export interface ContextWindowService {
  estimateTokens(messages: Message[]): number
  sharedPrefixLength(previous: readonly Message[], current: readonly Message[]): number
}

export function mountContextWindow(ctx: Context) {
  return ctx.plugin({
    name: 'agent-harness-context-window',
    apply(pluginCtx: Context) {
      const service: ContextWindowService = { estimateTokens, sharedPrefixLength }
      pluginCtx.provide('contextWindow', service)
    },
  })
}
