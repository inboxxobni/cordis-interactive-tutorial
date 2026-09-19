import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'check-system-prompt'
export const inject = ['systemPrompt', 'tools']

// Throwaway self-check: assemble() the REAL prompt, then assert it actually
// reflects the live tools service and the live directory - if a tool name or
// a real file name were hard-coded or stale, this fails.
const dir = path.dirname(fileURLToPath(import.meta.url))

export async function apply(ctx) {
  const prompt = await ctx.systemPrompt.assemble({ task: 'probe the workspace' })
  const fail = (msg) => {
    throw new Error(`check-system-prompt: ${msg}`)
  }

  if (typeof prompt !== 'string' || prompt.length === 0) fail('assemble() returned no string')

  // Every tool the live tools service advertises must appear by name.
  const definitions = ctx.tools.definitions
  if (!Array.isArray(definitions) || definitions.length === 0) fail('tools.definitions is not a non-empty array')
  for (const def of definitions) {
    if (!prompt.includes(def.name)) fail(`tool "${def.name}" missing from prompt`)
  }

  // Every real top-level entry in this directory must appear in the listing.
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
  const missing = names.filter((n) => !prompt.includes(n))
  if (missing.length) fail(`directory entries missing from prompt: ${missing.join(', ')}`)

  // The task really gets threaded through, and the prompt is not trivial.
  if (!prompt.includes('probe the workspace')) fail('task text missing from prompt')
  if (prompt.length < 200) fail(`prompt suspiciously short: ${prompt.length} chars`)

  console.log(
    `[check-system-prompt] ok: ${prompt.length} chars, ${definitions.length} tools, ${names.length} directory entries all present`,
  )
  console.log('--- system prompt (first 600 chars) ---')
  console.log(prompt.slice(0, 600))
}
