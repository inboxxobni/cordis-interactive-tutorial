/**
 * Chapter 21: System prompt. No auto-mount - ask the connected agent to
 * build system-prompt.mjs into the real workspace and mount it for real.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '21-system-prompt',
  title: 'System prompt',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build system-prompt.mjs (see the suggestion chip).' })
    return () => {}
  },
}
