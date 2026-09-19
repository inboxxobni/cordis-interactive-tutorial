/**
 * The `agentLoop` service - Volume 2, chapter 17 (mounted alone, PENDING)
 * through chapter 23 (all deps satisfied, ACTIVE, and driven for real). A
 * real `class extends Service`, `static inject = ['tools', 'llm',
 * 'systemPrompt']` - the exact real shape DeepSeek Harness's own
 * `packages/core/agent-loop` uses (a Service subclass, not a bare function),
 * scaled down to the real minimum: assemble context -> call the real llm ->
 * detect tool calls -> execute them for real -> loop until the model
 * replies with no tool calls. `contextWindow`/`compaction` are read via
 * `ctx.get(...)` (soft/optional - chapter 3's own "optional dependencies"
 * lesson, applied for real: the loop runs fine before chapters 19-20 mount
 * them, just without token-aware compaction).
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { ContentBlock, Message, ToolDefinition } from '@cordis-tutorial/shared'
import { fiberId, type Instrumented } from '../../../cordis-instrumentation.js'
import type { ToolsService } from './tools.js'
import type { LlmService } from './llm.js'
import type { SystemPromptService } from './system-prompt.js'
import type { ContextWindowService } from './context-window.js'
import './compaction.js' // pulls in the `agent-harness/compact` Events augmentation

const MAX_STEPS = 12

export function mountAgentLoop(ctx: Context, instr: Instrumented) {
  class AgentLoop extends Service {
    static inject = ['tools', 'llm', 'systemPrompt']
    private messages: Message[] = []

    constructor(serviceCtx: Context) {
      super(serviceCtx, 'agentLoop')
    }

    async runTurn(task: string): Promise<void> {
      const pluginId = fiberId(this.ctx.fiber)
      this.messages.push({ role: 'user', content: task })

      const tools = this.ctx.get('tools') as ToolsService
      const llm = this.ctx.get('llm') as LlmService
      const systemPrompt = this.ctx.get('systemPrompt') as SystemPromptService
      const contextWindow = this.ctx.get('contextWindow') as ContextWindowService | undefined

      for (let step = 0; step < MAX_STEPS; step++) {
        const estimatedTokens = contextWindow?.estimateTokens(this.messages) ?? 0
        const replacement = await this.ctx.serial('agent-harness/compact', { messages: this.messages, estimatedTokens })
        if (replacement) this.messages = replacement

        const systemText = await systemPrompt.assemble()
        const withSystem: Message[] = [{ role: 'system', content: systemText }, ...this.messages]
        const toolDefs: ToolDefinition[] = tools.definitions

        instr.emit({ type: 'agent_llm_call', pluginId })
        const response = await llm.chat(withSystem, toolDefs)

        const blocks: ContentBlock[] = []
        if (response.text) blocks.push({ type: 'text', text: response.text })
        for (const call of response.toolCalls) blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
        this.messages.push({ role: 'assistant', content: blocks })
        instr.emit({ type: 'assistant_message', text: response.text })

        if (response.toolCalls.length === 0) return

        const results: ContentBlock[] = []
        for (const call of response.toolCalls) {
          instr.emit({ type: 'agent_tool_call', pluginId, tool: call.name })
          instr.emit({ type: 'tool_call_start', toolCall: call })
          const started = Date.now()
          const run = await tools.execute(call.name, call.input)
          instr.emit({ type: 'tool_result', toolCallId: call.id, name: call.name, input: call.input, result: run.result, isError: run.isError, durationMs: Date.now() - started })
          results.push({ type: 'tool_result', tool_use_id: call.id, content: run.result, is_error: run.isError })
        }
        this.messages.push({ role: 'user', content: results })
      }
    }
  }

  const fiber = ctx.plugin(AgentLoop)
  instr.innerAgentLoop = { runTurn: (task: string) => (ctx.get('agentLoop') as { runTurn(task: string): Promise<void> }).runTurn(task) }
  return fiber
}
