/**
 * Chapter 17: The loop. Mounts the real agentLoop Service alone - watch its
 * fiber register and stay PENDING: `static inject = ['tools', 'llm',
 * 'systemPrompt']`, none of which exist yet. Later chapters mount them one
 * at a time; this fiber flips to ACTIVE for real in chapter 22, without
 * this chapter's own code changing at all.
 */
import type { Chapter } from './types.js'
import { composeAgentHarness } from './agent-harness/compose.js'

export const chapter: Chapter = {
  id: '17-the-loop',
  title: 'The loop',
  async run(instr) {
    return composeAgentHarness(instr, {})
  },
}
