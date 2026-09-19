/**
 * Chapter 21: System prompt. Adds the real systemPrompt service - agentLoop
 * is now only missing one dependency: llm.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '21-system-prompt',
  title: 'System prompt',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true, contextWindow: true, compaction: true, systemPrompt: true })
  },
}
