/**
 * Chapter 16: What is an agent. Orientation only, no plugins mounted yet -
 * this is the "Agent = LLM + control loop + tools + context management"
 * framing every chapter from here on builds one real piece of, as a real
 * Cordis plugin. See Theory.tsx for the full explanation and diagram.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '16-what-is-an-agent',
  title: 'What is an agent',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Orientation only - see the theory panel. Chapter 17 starts building the real thing.' })
    return () => {}
  },
}
