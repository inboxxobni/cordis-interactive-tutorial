/**
 * Chapter 15: Runtime inspection & Plugin Manager. Reference only - both are
 * real ACRYL/Harness packages this sandbox doesn't re-implement. The point
 * of this chapter is disambiguation, not simulation: see Theory.tsx for why
 * neither one is what this tutorial's own mount_plugin does.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '15-runtime-inspection-and-install',
  title: 'Runtime inspection & Plugin Manager',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Reference-only chapter - see the theory panel: dsh-tool-cordis is read-only inspection, Plugin Manager is persistent/session-wide, and this tutorial\'s mount_plugin is neither.' })
    return () => {}
  },
}
