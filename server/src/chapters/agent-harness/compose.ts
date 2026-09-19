/**
 * Shared composition helper for chapters 17-23: each chapter mounts the
 * cumulative subset of real plugins that chapter's own theory covers, self-
 * contained the same way every other chapter in this tutorial is (mount
 * fresh, dispose on stop/switch - no cross-chapter mutable state). This is
 * what lets you watch the SAME agentLoop fiber sit PENDING through chapters
 * 17-21 and flip to ACTIVE the moment chapter 22 mounts the last dependency.
 */
import type { Fiber } from '@deepseek-ai/cordis'
import type { Instrumented } from '../../cordis-instrumentation.js'
import type { Teardown } from '../types.js'
import { mountAgentLoop } from './plugins/agent-loop.js'
import { mountTools } from './plugins/tools.js'
import { mountContextWindow } from './plugins/context-window.js'
import { mountCompaction } from './plugins/compaction.js'
import { mountSystemPrompt } from './plugins/system-prompt.js'
import { mountLlm } from './plugins/llm.js'

export interface AgentHarnessParts {
  tools?: boolean
  contextWindow?: boolean
  compaction?: boolean
  systemPrompt?: boolean
  llm?: boolean
}

export async function composeAgentHarness(instr: Instrumented, parts: AgentHarnessParts): Promise<Teardown> {
  const { ctx } = instr
  const fibers: Fiber[] = [mountAgentLoop(ctx, instr)]
  if (parts.tools) fibers.push(mountTools(ctx, instr))
  if (parts.contextWindow) fibers.push(mountContextWindow(ctx))
  if (parts.compaction) fibers.push(mountCompaction(ctx))
  if (parts.systemPrompt) fibers.push(mountSystemPrompt(ctx, instr))
  if (parts.llm) fibers.push(mountLlm(ctx, instr))
  await Promise.all(fibers)

  return async () => {
    instr.innerAgentLoop = null
    for (const fiber of [...fibers].reverse()) await fiber.dispose()
  }
}
