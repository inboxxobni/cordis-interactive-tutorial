/**
 * Chapter 11: Package and install a plugin. Reference only - installing a
 * real bundle needs pnpm, a real profile directory, and package.json
 * mutation; out of scope for this teaching sandbox. See Theory.tsx for the
 * real explanation (two manifests, loading order, the GitHub build-script
 * catch) and .claude/skills/cordis-plugin-quickstart/ in the ACRYL repo for
 * the actually-usable local equivalent.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '11-package-and-install',
  title: 'Package and install a plugin',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Reference-only chapter - see the theory panel. Real installs need pnpm + a real profile; not something this sandbox runs.' })
    return () => {}
  },
}
