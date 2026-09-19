/**
 * Chapter 19: Context window. Adds the real contextWindow service (token
 * estimate + cacheable-prefix length) alongside tools + agentLoop.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '19-context-window',
  title: 'Context window',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true, contextWindow: true })
  },
}
