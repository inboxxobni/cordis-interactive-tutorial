/**
 * Chapter 18: Tools. No auto-mount - ask the connected agent to build
 * tools.mjs into the real workspace and mount it for real.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '18-tools',
  title: 'Tools',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build tools.mjs (see the suggestion chip).' })
    return () => {}
  },
}
