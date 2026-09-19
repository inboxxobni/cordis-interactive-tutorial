/**
 * Chapter 18: Tools. Adds the real tools service (4 real tools: list/read/
 * write/edit, the tutorial's own real ones, same shared workspace) alongside
 * agentLoop - still PENDING, still missing llm and systemPrompt.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '18-tools',
  title: 'Tools',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true })
  },
}
