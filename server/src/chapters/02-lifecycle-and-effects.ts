/**
 * Chapter 2: Lifecycle and effects.
 *
 * Anything that outlives the apply() call - a timer here - must be acquired
 * inside ctx.effect() and return a disposer. Cordis runs that disposer when
 * the fiber unloads. This chapter mounts the plugin, lets its heartbeat tick
 * a few times, then disposes it so you can watch the teardown happen too.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'
import { fiberId, type Instrumented } from '../cordis-instrumentation.js'

function heartbeatPlugin(instr: Instrumented) {
  return {
    name: 'heartbeat',
    apply(ctx: Context) {
      // Same id fiber_state_change already reported for this plugin - not a
      // separate hand-picked label - so the UI can correlate them.
      const pluginId = fiberId(ctx.fiber)
      ctx.effect(() => {
        const dispose = () => clearInterval(timer)
        const timer = setInterval(() => {
          instr.emit({ type: 'log', pluginId, message: 'tick' })
        }, 1_000)
        return instr.reportEffect(pluginId, 'heartbeat timer', dispose)
      }, 'heartbeat: timer')
    },
  }
}

export const chapter: Chapter = {
  id: '02-lifecycle-and-effects',
  title: 'Lifecycle and effects',
  async run(instr) {
    const fiber = instr.ctx.plugin(heartbeatPlugin(instr))
    await fiber
    return () => fiber.dispose()
  },
}
