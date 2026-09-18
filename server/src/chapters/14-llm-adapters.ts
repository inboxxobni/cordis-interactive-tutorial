/**
 * Chapter 14: LLM adapters. Reference only - a real LlmAdapter needs the
 * full Harness LLM plumbing (GenerateOptions, StreamChunk types, provider
 * registration) this sandbox deliberately doesn't pull in. See Theory.tsx
 * for the real stream()/StreamChunk contract.
 */
import type { Chapter } from './types.js'

export const chapter: Chapter = {
  id: '14-llm-adapters',
  title: 'LLM adapters',
  async run({ emit }) {
    emit({ type: 'log', pluginId: null, message: 'Reference-only chapter - see the theory panel for the real stream()/StreamChunk contract.' })
    return () => {}
  },
}
