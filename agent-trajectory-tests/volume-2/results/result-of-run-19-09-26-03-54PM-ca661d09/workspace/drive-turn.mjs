export const name = 'drive-turn'
export const inject = ['agentLoop']

// A real driver for one turn. Two ways to give it a task:
//   - mount config:  mount_plugin('drive-turn.mjs', { task: '...' })
//   - environment:   CORDIS_AGENT_TASK='...' pnpm dev
// With no task it stays inert and just prints a hint, so mounting this file
// in a host that mounts everything (run.mjs) is harmless.
export async function apply(ctx, config = {}) {
  const task = config?.task ?? process.env.CORDIS_AGENT_TASK
  if (!task) {
    console.log('[drive-turn] no task given - pass { task } as mount config, or set CORDIS_AGENT_TASK')
    return
  }

  console.log(`[drive-turn] task: ${task}`)
  const started = Date.now()
  const trace = await ctx.agentLoop.runTurn(task)

  for (const [i, step] of trace.steps.entries()) {
    const result = typeof step.result === 'string' ? step.result : JSON.stringify(step.result ?? null)
    console.log(
      `[drive-turn] step ${i + 1}: ${step.tool}(${JSON.stringify(step.input)}) -> ${result.slice(0, 200)}`,
    )
  }

  console.log(`[drive-turn] done=${trace.done} steps=${trace.steps.length} ms=${Date.now() - started}`)
  console.log(`[drive-turn] answer: ${String(trace.final?.content ?? '').trim()}`)
  if (!trace.done) console.log(`[drive-turn] note: ${trace.reason}`)
}
