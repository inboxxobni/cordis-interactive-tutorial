/**
 * Chapter 22: Providers. No auto-mount - ask the connected agent to build
 * llm.mjs into the real workspace and mount it for real. Once mounted,
 * agentLoop's real inject list (tools/llm/systemPrompt) is fully satisfied
 * for the first time - watch its fiber flip PENDING -> ACTIVE for real.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '22-providers',
  title: 'Providers',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build llm.mjs (see the suggestion chip).' })
    return () => {}
  },
}
