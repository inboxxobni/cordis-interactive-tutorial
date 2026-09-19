/**
 * Chapter 23: The harness. The exact same full composition as chapter 22 -
 * mounting it is inert, zero LLM spend. The Agent console's one suggestion
 * chip for this chapter is the explicit, deliberate trigger for a real
 * turn (see the `run_inner_agent` WS message in index.ts, and
 * instr.innerAgentLoop, set by composeAgentHarness -> mountAgentLoop).
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '23-the-harness',
  title: 'The harness',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true, contextWindow: true, compaction: true, systemPrompt: true, llm: true })
  },
}
