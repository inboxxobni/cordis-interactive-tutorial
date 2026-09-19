/**
 * Chapter 24: This app. Recap only, no auto-mount - by now the connected
 * agent has built and mounted all six real files into workspace/. See
 * Theory.tsx for the real file-by-file breakdown, and the suggestion chip
 * for a real final check (read each file back, confirm it's really there).
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '24-this-app',
  title: 'This app',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Recap only - see the theory panel, and use the suggestion chip to have the agent verify what it built.' })
    return () => {}
  },
}
