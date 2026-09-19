/**
 * The payoff tool for Volume 2 (chapter 23): drives a real turn through
 * whatever the connected agent itself mounted under the 'agentLoop' service
 * name - real, not simulated, and it works regardless of how that service
 * got there (built in this session, or already-mounted from an earlier
 * turn). Narrowly scoped to exactly one named service and one method - not
 * a generic invoke backdoor - so it doesn't blur the real read-only
 * boundary cordis_inspect_list/cordis_inspect_query keep (chapter 15's own
 * lesson: inspection cannot invoke anything; this is a separate, deliberate
 * capability for a separate, deliberate purpose).
 */
import type { Tool, ToolRunResult } from './registry.js'

export const runWorkspaceAgentTurn: Tool = {
  def: {
    name: 'run_workspace_agent_turn',
    description:
      'Run one real turn through the agent-loop YOU built and mounted in this workspace (the plugin providing the "agentLoop" service). Give it a real task. This calls its real runTurn(task) method - a real LLM call, real tool calls, against this same shared workspace.',
    input_schema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'The task to give the workspace agent.' } },
      required: ['task'],
    },
  },
  async run(input, ctx): Promise<ToolRunResult> {
    const task = String(input.task ?? '')
    if (!task) return { result: 'Error: task is required.', isError: true }
    const agentLoop = ctx.instr.ctx.get('agentLoop') as { runTurn: (task: string) => Promise<void> } | undefined
    if (!agentLoop) {
      return { result: 'Error: no "agentLoop" service is mounted right now - build and mount agent-loop.mjs (and its dependencies) first.', isError: true }
    }
    await agentLoop.runTurn(task)
    return { result: 'The workspace agent finished its turn. Check the workspace files and the live trace for what it actually did.', isError: false }
  },
}
