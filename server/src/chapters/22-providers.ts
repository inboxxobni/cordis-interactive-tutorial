/**
 * Chapter 22: Providers. Adds the real llm service, wired to whatever
 * provider is already configured in Settings. Every one of agentLoop's
 * `static inject` dependencies is now satisfied - watch its fiber flip
 * PENDING -> ACTIVE for real, live on the canvas.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '22-providers',
  title: 'Providers',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true, contextWindow: true, compaction: true, systemPrompt: true, llm: true })
  },
}
