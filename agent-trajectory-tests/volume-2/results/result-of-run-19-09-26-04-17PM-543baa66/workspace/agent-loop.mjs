// agent-loop.mjs - the turn driver: the plugin that makes this a coding agent
// rather than a chat UI. One turn = model <-> tools cycle until the model stops
// asking for tools (or the step budget runs out).
//
// Provides: agentLoop  ->  ctx.agentLoop.runTurn(task)
// Injects:  tools, llm, systemPrompt
//
// Fiber state: PENDING (healthy) until all three dependencies are provided;
// flips to ACTIVE by itself when the last one appears - mount order is
// irrelevant, because Cordis resolves by service name, not by load order.
import { Service } from '@deepseek-ai/cordis'

export const name = 'agent-loop'

// Cordis reads `inject` off the mounted module (object form) - this is the
// declaration that gates activation. The class also carries it as a static so
// the dependency contract travels with the service type.
export const inject = ['tools', 'llm', 'systemPrompt']

/** Hard budget: never let a turn loop forever. */
const MAX_STEPS = 10

export class AgentLoop extends Service {
  static inject = ['tools', 'llm', 'systemPrompt']

  constructor(ctx) {
    super(ctx, 'agentLoop')
    console.log('[agent-loop] active - provided agentLoop (runTurn)')
  }

  /**
   * Run one real turn.
   *
   * @param {string} task - the user's request, pushed as a `user` message.
   * @returns the full transcript, the tool-call trace and the final reply.
   */
  async runTurn(task) {
    const ctx = this.ctx

    const messages = []
    const steps = []

    // The prompt is assembled live (tool list + workspace listing), so it can
    // never describe capabilities or files that no longer exist.
    const systemPrompt = await ctx.systemPrompt.assemble({ task })
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    messages.push({ role: 'user', content: task })

    for (let step = 1; step <= MAX_STEPS; step++) {
      // `definitions` is what the model is allowed to call this step.
      const reply = await ctx.llm.chat(messages, ctx.tools.definitions)
      messages.push(reply)

      const calls = reply?.tool_calls ?? []
      if (!calls.length) {
        return { messages, steps, final: reply, done: true, stepsUsed: step }
      }

      console.log(`[agent-loop] step ${step}: ${calls.length} tool call(s)`)

      // Execute every requested call and feed the results back as `tool`
      // messages; that feedback is the whole difference from a chat UI.
      for (const call of calls) {
        const toolName = call.function?.name ?? call.name
        let input = call.function?.arguments ?? call.arguments ?? {}
        if (typeof input === 'string') {
          try {
            input = JSON.parse(input)
          } catch {
            input = { _raw: input }
          }
        }

        let result
        try {
          result = await ctx.tools.execute(toolName, input)
        } catch (err) {
          // A failing tool is information for the model, not a crashed turn.
          result = { error: err instanceof Error ? err.message : String(err) }
        }

        steps.push({ tool: toolName, input, result })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: typeof result === 'string' ? result : JSON.stringify(result ?? null),
        })
      }
    }

    return {
      messages,
      steps,
      final: messages[messages.length - 1],
      done: false,
      stepsUsed: MAX_STEPS,
      reason: `hit MAX_STEPS (${MAX_STEPS})`,
    }
  }
}

// Class-as-apply: the constructor runs as apply() and super(ctx, 'agentLoop')
// is what actually provides the service on this Context.
export { AgentLoop as apply }
