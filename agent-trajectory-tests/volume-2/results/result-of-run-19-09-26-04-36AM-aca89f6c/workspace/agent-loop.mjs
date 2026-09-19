import { Service } from '@deepseek-ai/cordis'

export const name = 'agent-loop'

// The module is also the plugin, but keep the inject list at module level so
// the fiber state is honest even if the loader reads exports instead of statics.
export const inject = ['tools', 'llm', 'systemPrompt']

const MAX_STEPS = 10

/** Normalize whatever shape the llm service hands back into one assistant turn. */
function normalizeReply(reply) {
  const message = reply?.message ?? reply ?? {}
  const rawCalls = reply?.toolCalls ?? reply?.tool_calls
    ?? message?.toolCalls ?? message?.tool_calls
    ?? []
  const toolCalls = (Array.isArray(rawCalls) ? rawCalls : []).map((call) => {
    const fn = call.function ?? call
    let input = call.input ?? fn.input ?? fn.arguments ?? {}
    if (typeof input === 'string') {
      try { input = JSON.parse(input) } catch { input = { raw: input } }
    }
    return { id: call.id ?? call.tool_call_id, name: fn.name ?? call.name, input }
  }).filter((call) => typeof call.name === 'string' && call.name)
  const content = typeof reply === 'string'
    ? reply
    : (reply?.content ?? message?.content ?? '')
  return { content, toolCalls, message }
}

export class AgentLoop extends Service {
  static inject = ['tools', 'llm', 'systemPrompt']

  constructor(ctx) {
    super(ctx, 'agentLoop')
    this.maxSteps = MAX_STEPS
  }

  /** Build the system message from the real systemPrompt service. */
  async systemMessage(options = {}) {
    if (options.system) return { role: 'system', content: String(options.system) }
    const service = this.ctx.systemPrompt
    if (!service) return null
    try {
      // systemPrompt.message() is the async shape; fall back to a plain string.
      const built = typeof service.message === 'function'
        ? await service.message(options)
        : await service.assemble?.(options)
      if (!built) return null
      return typeof built === 'string' ? { role: 'system', content: built } : built
    } catch (err) {
      this.ctx.logger?.warn?.('[agent-loop] could not assemble system prompt: %s', err?.message ?? err)
      return null
    }
  }

  async runTurn(task, options = {}) {
    const messages = Array.isArray(options.messages) ? [...options.messages] : []

    // The systemPrompt dependency is only real if it actually reaches the model.
    const hasSystem = messages.some((m) => m?.role === 'system')
    if (!hasSystem) {
      const system = await this.systemMessage(options)
      if (system) messages.push(system)
    }

    messages.push({ role: 'user', content: String(task ?? '') })

    const maxSteps = Number(options.maxSteps) || this.maxSteps
    let steps = 0

    for (let step = 1; step <= maxSteps; step++) {
      steps = step
      const reply = await this.ctx.llm.chat(messages, this.ctx.tools.definitions)
      const { content, toolCalls, message } = normalizeReply(reply)

      messages.push(
        message && typeof message === 'object' && !Array.isArray(message)
          ? { ...message, role: 'assistant', content }
          : { role: 'assistant', content },
      )

      if (toolCalls.length === 0) {
        return { task, content, steps, messages, toolCalls: [], done: true }
      }

      for (const call of toolCalls) {
        let output
        try {
          output = await this.ctx.tools.execute(call.name, call.input)
        } catch (err) {
          output = `Error: ${err instanceof Error ? err.message : String(err)}`
        }
        const text = typeof output === 'string' ? output : JSON.stringify(output ?? null)
        this.ctx.logger?.info?.('[agent-loop] tool %s -> %s', call.name, text.slice(0, 200))
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: text,
        })
      }
    }

    return {
      task,
      content: `[agent-loop] stopped after ${steps} steps without a final answer`,
      steps,
      messages,
      toolCalls: [],
      done: false,
    }
  }
}

/**
 * Module is also runnable as a plugin: apply() runs only once every name in
 * `inject` resolves, then the Service registers itself as `ctx.agentLoop`.
 */
export function apply(ctx) {
  new AgentLoop(ctx)
}

export default AgentLoop
