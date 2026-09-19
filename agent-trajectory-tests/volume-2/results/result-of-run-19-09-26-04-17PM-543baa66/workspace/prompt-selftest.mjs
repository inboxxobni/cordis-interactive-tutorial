// prompt-selftest.mjs - deliberate PROBE, not product code.
//
// Purpose: prove assemble() is derived from the LIVE environment rather than
// hard-coded - every tool name comes from ctx.tools.definitions and the file
// list from a real readdir of this directory.
//
// Expect: ACTIVE (pass). FAILED names exactly which expectation was violated.
export const name = 'prompt-selftest'
export const inject = ['systemPrompt', 'tools']

export async function apply(ctx) {
  const prompt = await ctx.systemPrompt.assemble({ task: 'PROBE-TASK-MARKER' })

  const defs = Array.isArray(ctx.tools.definitions) ? ctx.tools.definitions : []
  const missingTools = defs.filter((d) => !prompt.includes(d.name)).map((d) => d.name)
  const hasTask = prompt.includes('PROBE-TASK-MARKER')
  const hasThisFile = prompt.includes('prompt-selftest.mjs')

  const summary =
    `definitions=${defs.length} chars=${prompt.length} ` +
    `missingToolNames=${JSON.stringify(missingTools)} taskEcho=${hasTask} ` +
    `listsOwnFilename=${hasThisFile}`

  if (missingTools.length || !hasTask || !hasThisFile) {
    throw new Error(`PROMPT SELFTEST FAILED: ${summary}`)
  }
  console.log(`[prompt-selftest] PASS - ${summary}`)
}
