/**
 * Chapter 20: Cache & compact. No auto-mount - ask the connected agent to
 * build compaction.mjs into the real workspace and mount it for real.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '20-cache-and-compact',
  title: 'Cache & compact',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build compaction.mjs (see the suggestion chip).' })
    return () => {}
  },
}
