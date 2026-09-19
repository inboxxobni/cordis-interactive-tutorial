export const name = 'agent-loop'
export const inject = ['tools', 'llm', 'systemPrompt']

const MAX_STEPS = 10

export class AgentLoop {
  constructor(ctx) {
    this.ctx = ctx
  }

  /**
   * Run one real turn: push the task as a user message, then drive the
   * model <-> tools cycle until it stops asking for tools (or we hit the
   * step budget).
   */
  async runTurn(task) {
    const ctx = this.ctx
    const messages = []

    const systemPrompt = await ctx.systemPrompt.assemble({ task })
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: task })

    const steps = []

    for (let step = 0; step < MAX_STEPS; step++) {
      const definitions = ctx.tools.definitions
      const reply = await ctx.llm.chat(messages, definitions)

      messages.push(reply)

      const calls = reply?.tool_calls ?? []
      if (calls.length === 0) {
        return { messages, steps, final: reply, done: true }
      }

      for (const call of calls) {
        const name = call.function?.name ?? call.name
        const rawInput = call.function?.arguments ?? call.arguments
        let input = rawInput
        if (typeof rawInput === 'string') {
          try {
            input = JSON.parse(rawInput)
          } catch {
            input = { _raw: rawInput }
          }
        }

        let result
        try {
          result = await ctx.tools.execute(name, input)
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) }
        }

        const content =
          typeof result === 'string' ? result : JSON.stringify(result ?? null)

        steps.push({ tool: name, input, result })

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name,
          content,
        })
      }
    }

    return {
      messages,
      steps,
      final: messages[messages.length - 1],
      done: false,
      reason: `hit MAX_STEPS (${MAX_STEPS})`,
    }
  }
}

export function apply(ctx) {
  ctx.provide('agentLoop', new AgentLoop(ctx))
  console.log('[agent-loop] active - provided agentLoop')
}
