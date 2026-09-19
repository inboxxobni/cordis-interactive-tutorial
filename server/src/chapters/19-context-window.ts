/**
 * Chapter 19: Context window. No auto-mount - ask the connected agent to
 * build context-window.mjs into the real workspace and mount it for real.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '19-context-window',
  title: 'Context window',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build context-window.mjs (see the suggestion chip).' })
    return () => {}
  },
}
