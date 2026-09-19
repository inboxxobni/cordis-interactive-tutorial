import { Service } from '@deepseek-ai/cordis'

export const name = 'agent-loop'
export const inject = ['tools', 'llm', 'systemPrompt']

const MAX_STEPS = 10

export default class AgentLoop extends Service {
  static inject = inject

  constructor(ctx) {
    super(ctx, 'agentLoop')
  }

  /**
   * One real turn: system prompt + task, then loop until the model stops
   * asking for tools (or we hit the step cap).
   */
  async runTurn(task) {
    if (typeof task !== 'string' || task.trim() === '') {
      throw new Error('agentLoop.runTurn: task must be a non-empty string')
    }

    // Fresh message list per turn - no hidden cross-turn state.
    const messages = []

    const system = await this.ctx.systemPrompt.assemble()
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: task })

    let steps = 0
    let toolCallsMade = 0

    for (; steps < MAX_STEPS; steps++) {
      const reply = await this.ctx.llm.chat(messages, this.ctx.tools.definitions)
      messages.push(reply)

      const toolCalls = reply?.toolCalls ?? []
      if (toolCalls.length === 0) break // no tools requested -> turn is done

      for (const call of toolCalls) {
        let content
        try {
          const result = await this.ctx.tools.execute(call.name, call.input)
          content = typeof result === 'string' ? result : JSON.stringify(result)
        } catch (err) {
          // A failing tool is data for the model, not a crash for the loop.
          content = `error: ${err instanceof Error ? err.message : String(err)}`
        }
        toolCallsMade++
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content,
        })
      }
    }

    const last = messages[messages.length - 1]
    return {
      messages,
      steps,
      toolCalls: toolCallsMade,
      text: typeof last?.content === 'string' ? last.content : '',
    }
  }
}

export { AgentLoop as apply }
