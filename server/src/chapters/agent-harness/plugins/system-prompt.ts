/**
 * The `systemPrompt` service - Volume 2, chapter 21. Assembles the real
 * stable prefix from whatever tools are actually registered and the real
 * workspace listing, reusing the tutorial's own already-working
 * buildSystemPrompt()/buildWorkspaceSummary() (server/src/system-prompt.ts)
 * rather than a second prompt-building implementation.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Instrumented } from '../../../cordis-instrumentation.js'
import { buildSystemPrompt, buildWorkspaceSummary } from '../../../system-prompt.js'
import type { ToolDefinition } from '@cordis-tutorial/shared'

export interface SystemPromptService {
  assemble(): Promise<string>
}

export function mountSystemPrompt(ctx: Context, instr: Instrumented) {
  return ctx.plugin({
    name: 'agent-harness-system-prompt',
    apply(pluginCtx: Context) {
      const service: SystemPromptService = {
        async assemble() {
          const tools = (pluginCtx.get('tools') as { definitions: ToolDefinition[] } | undefined)?.definitions ?? []
          const files = await instr.workspace.list()
          return buildSystemPrompt(buildWorkspaceSummary(files), tools)
        },
      }
      pluginCtx.provide('systemPrompt', service)
    },
  })
}
