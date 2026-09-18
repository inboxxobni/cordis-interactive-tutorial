/**
 * The agent loop, ported from Agent Loop (aicodingagent-ts). Every step
 * emits a TraceEvent so the browser can animate it. Tool execution here
 * includes mount_plugin, which reaches into the real instrumented Cordis
 * Context - that's the whole point of this prototype.
 */
import type { ContentBlock, Message, TextBlock, ToolDefinition, ToolResultBlock, ToolUseBlock } from '@cordis-tutorial/shared'
import type { Emit } from './trace.js'
import type { LLMProvider } from './providers/types.js'
import type { AgentControl } from './control.js'
import { StopSignal } from './control.js'
import type { Tool } from './tools/registry.js'
import { executeTool } from './tools/registry.js'
import type { Workspace } from './workspace.js'
import type { Instrumented } from './cordis-instrumentation.js'
import { buildSystemPrompt, buildWorkspaceSummary } from './system-prompt.js'
import { sharedPrefixLength, estimateTokens } from './context.js'

export interface AgentOptions {
  provider: LLMProvider
  workspace: Workspace
  tools: Tool[]
  emit: Emit
  instr: Instrumented
  maxSteps: number
  speedMs: number
  control: AgentControl
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((r) => setTimeout(r, ms))
}

export class Agent {
  private messages: Message[] = []
  private turnCount = 0
  private previousRequest: Message[] = []

  constructor(private opts: AgentOptions) {}

  updateOptions(opts: AgentOptions): void {
    this.opts = opts
  }

  async runTurn(userMessage: string): Promise<void> {
    const { emit, control, maxSteps, provider, workspace, tools, speedMs, instr } = this.opts

    const files = await workspace.list()
    const systemPrompt = buildSystemPrompt(buildWorkspaceSummary(files), tools.map((t) => t.def))
    if (this.messages.length === 0 || this.messages[0]?.role !== 'system') {
      this.messages.unshift({ role: 'system', content: systemPrompt })
    } else {
      this.messages[0] = { role: 'system', content: systemPrompt }
    }
    this.messages.push({ role: 'user', content: userMessage })

    this.turnCount += 1
    emit({ type: 'turn_start', turn: this.turnCount, userMessage })

    let totalTokens = 0
    const toolDefs: ToolDefinition[] = tools.map((t) => t.def)

    try {
      for (let iteration = 1; iteration <= maxSteps; iteration++) {
        await control.gate()

        const contextTokens = estimateTokens(this.messages)
        emit({ type: 'loop_start', iteration, maxSteps, contextTokens, messageCount: this.messages.length })
        emit({ type: 'status', status: 'calling-llm' })
        await delay(speedMs)

        emit({
          type: 'llm_request',
          provider: provider.id,
          model: provider.model,
          url: provider.baseURL,
          messageCount: this.messages.length,
          tools: toolDefs.map((t) => t.name),
          payload: { messages: this.messages, tools: toolDefs },
          cacheableMessageCount: sharedPrefixLength(this.previousRequest, this.messages),
        })
        this.previousRequest = structuredClone(this.messages)

        let resp
        try {
          resp = await provider.chat(this.messages, toolDefs, (text) => emit({ type: 'llm_delta', text }), undefined)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          emit({ type: 'error', message, fatal: true })
          emit({ type: 'status', status: 'error' })
          return
        }

        emit({ type: 'llm_response', text: resp.text, toolCalls: resp.toolCalls, stopReason: resp.stopReason, usage: resp.usage, raw: resp.raw })
        totalTokens += resp.usage.input_tokens + resp.usage.output_tokens

        const assistantBlocks: ContentBlock[] = []
        if (resp.text) {
          assistantBlocks.push({ type: 'text', text: resp.text } satisfies TextBlock)
          emit({ type: 'assistant_message', text: resp.text })
        }
        for (const tc of resp.toolCalls) {
          assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input } satisfies ToolUseBlock)
        }
        this.messages.push({ role: 'assistant', content: assistantBlocks.length ? assistantBlocks : [{ type: 'text', text: '' }] })

        if (resp.toolCalls.length === 0) {
          emit({ type: 'loop_end', iteration, stopReason: resp.stopReason, usage: resp.usage, totalTokens })
          emit({ type: 'turn_end', turn: this.turnCount, stopReason: resp.stopReason, totalTokens, steps: iteration })
          emit({ type: 'status', status: 'done' })
          return
        }

        emit({ type: 'status', status: 'executing-tools' })
        await delay(speedMs)
        const toolResults: ToolResultBlock[] = []
        for (const tc of resp.toolCalls) {
          const tool = tools.find((t) => t.def.name === tc.name)
          if (!tool) {
            const result = `Error: unknown tool "${tc.name}".`
            toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: result, is_error: true })
            emit({ type: 'tool_result', toolCallId: tc.id, name: tc.name, input: tc.input, result, isError: true, durationMs: 0 })
            continue
          }
          emit({ type: 'tool_call_start', toolCall: tc })
          const t0 = Date.now()
          const run = await executeTool(tool, tc.input, { workspace, emit, instr })
          const dt = Date.now() - t0
          toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: run.result, is_error: run.isError })
          emit({ type: 'tool_result', toolCallId: tc.id, name: tc.name, input: tc.input, result: run.result, isError: run.isError, durationMs: dt })
        }
        this.messages.push({ role: 'user', content: toolResults })
        emit({ type: 'loop_end', iteration, stopReason: 'tool_use', usage: resp.usage, totalTokens })
      }

      emit({ type: 'max_steps_reached', maxSteps })
      emit({ type: 'turn_end', turn: this.turnCount, stopReason: 'max_steps', totalTokens, steps: maxSteps })
      emit({ type: 'status', status: 'done' })
    } catch (err) {
      if (err instanceof StopSignal) {
        emit({ type: 'turn_end', turn: this.turnCount, stopReason: 'stopped', totalTokens, steps: 0 })
        emit({ type: 'status', status: 'done', message: 'stopped' })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: 'error', message, fatal: true })
      emit({ type: 'status', status: 'error' })
    }
  }
}
