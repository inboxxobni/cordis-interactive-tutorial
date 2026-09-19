/**
 * Chapter 23: The harness. No auto-mount - by now the connected agent has
 * built all six real files into the workspace (agent-loop.mjs, tools.mjs,
 * llm.mjs, system-prompt.mjs, context-window.mjs, compaction.mjs) and
 * mounted them. This chapter's suggestion chip is the payoff: it calls the
 * real run_workspace_agent_turn tool, driving one real turn through
 * whatever the agent actually mounted under the 'agentLoop' service name -
 * a real LLM call, real tool calls, against the same shared workspace.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '23-the-harness',
  title: 'The harness',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - if agent-loop.mjs is already mounted and ACTIVE, use the suggestion chip to run a real task through it.' })
    return () => {}
  },
}
