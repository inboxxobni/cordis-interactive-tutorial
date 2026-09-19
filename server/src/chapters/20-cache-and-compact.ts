/**
 * Chapter 20: Cache & compact. Adds the real compaction plugin - one Cordis
 * event hook (`agent-harness/compact`, serial dispatch) that only replaces
 * the message list once the estimated token count crosses a threshold.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '20-cache-and-compact',
  title: 'Cache & compact',
  async run(instr) {
    return composeAgentHarness(instr, { tools: true, contextWindow: true, compaction: true })
  },
}
