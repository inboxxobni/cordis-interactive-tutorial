/**
 * Chapter 12: ACRYL's built-in services. Reference only - these are real
 * named services in the actual ACRYL codebase, not something this sandbox
 * re-implements (they depend on the real runtime). See Theory.tsx for the
 * file:line citations.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '12-built-in-services',
  title: "ACRYL's built-in services",
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Reference-only chapter - see the theory panel for real file:line citations into runtime/acryl-control and runtime/acryl-harness-runtime.' })
    return () => {}
  },
}
