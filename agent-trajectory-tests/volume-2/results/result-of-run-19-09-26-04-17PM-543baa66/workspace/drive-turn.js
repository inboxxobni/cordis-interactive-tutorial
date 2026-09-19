// drive-turn.js - standalone driver: one REAL turn through the agent you built.
//
// Why .js and not .mjs: run.mjs mounts every *.mjs in this directory as a
// plugin. This file is a host script, not a plugin, so it must stay out of that
// glob - and package.json has "type": "module", so .js is still ESM.
//
// Why it exists: run.mjs boots the Context and mounts the plugins, but it never
// calls runTurn(). Mounting an agentLoop does not run a turn; something has to
// call the service method. That is this file.
//
// Usage:
//   node drive-turn.js "list the files here and summarize them"
//   CORDIS_AGENT_TASK="..." node drive-turn.js
import { Context } from '@deepseek-ai/cordis'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))

// Dependency order is not required by Cordis (it resolves by service name), but
// mounting leaves-first means agentLoop goes ACTIVE on its own, in one pass.
const PLUGINS = [
  'tools.mjs',
  'context-window.mjs',
  'compaction.mjs',
  'system-prompt.mjs',
  'llm.mjs',
  'agent-loop.mjs',
]

const task = process.argv.slice(2).join(' ').trim() || process.env.CORDIS_AGENT_TASK || ''
if (!task) {
  console.error('usage: node drive-turn.js "<task>"   (or set CORDIS_AGENT_TASK)')
  process.exit(2)
}

const ctx = new Context()

for (const file of PLUGINS) {
  const mod = await import(pathToFileURL(path.join(dir, file)).href)
  // Awaiting the fiber settles its activation (and rethrows a real failure).
  await ctx.plugin(mod, {})
}

console.log(`\n[drive-turn] task: ${task}\n`)

const trace = await ctx.agentLoop.runTurn(task)

for (const [i, step] of trace.steps.entries()) {
  console.log(`[drive-turn] tool ${i + 1}: ${step.tool} ${JSON.stringify(step.input)}`)
}

console.log('\n=== final answer ===\n')
console.log(trace.final?.content ?? '(no content)')
console.log(
  `\n[drive-turn] done=${trace.done} steps=${trace.stepsUsed} toolCalls=${trace.steps.length}` +
    (trace.reason ? ` reason=${trace.reason}` : ''),
)

process.exit(0)
