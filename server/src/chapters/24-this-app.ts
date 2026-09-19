/**
 * Chapter 24: This app. Recap only, no plugins mounted - documents the
 * architecture chapters 17-23 actually built. See Theory.tsx for the real
 * file-by-file breakdown (server/src/chapters/agent-harness/plugins/*).
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '24-this-app',
  title: 'This app',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Recap only - see the theory panel for how this volume is actually built, file by file.' })
    return () => {}
  },
}
