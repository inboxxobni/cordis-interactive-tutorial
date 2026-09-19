/**
 * Chapter 17: The loop. No auto-mount - this volume's whole point is that
 * YOU (via the connected agent, right pane) write agent-loop.mjs into the
 * real workspace and mount it for real, the same write_file/mount_plugin
 * mechanism every earlier chapter already uses. See the Agent console's
 * suggestion chip and Theory.tsx for the real shape to build.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '17-the-loop',
  title: 'The loop',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Nothing auto-mounts here - ask the connected agent to build agent-loop.mjs (see the suggestion chip).' })
    return () => {}
  },
}
