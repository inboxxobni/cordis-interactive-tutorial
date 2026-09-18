/**
 * Chapter 4: Events.
 *
 * ctx.on() registers a listener that Cordis automatically removes when the
 * fiber unloads - no manual cleanup needed, unlike a raw timer. This chapter
 * has one plugin listen, and a second plugin broadcast, so you can watch a
 * real event_emit reach a real event_listen.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'
import { fiberId, type Instrumented } from '../cordis-instrumentation.js'

// Cordis types every event through declaration merging on its own `Events`
// interface (see node_modules/@deepseek-ai/cordis/src/events.ts) - a plugin
// can't just emit an arbitrary string, it augments this interface the same
// way a real plugin package would.
declare module '@deepseek-ai/cordis' {
  interface Events {
    'tutorial/greeting'(who: string): void
  }
}

function listenerPlugin(instr: Instrumented) {
  return {
    name: 'greeting-listener',
    apply(ctx: Context) {
      const pluginId = fiberId(ctx.fiber)
      instr.reportListen(pluginId, 'tutorial/greeting')
      ctx.on('tutorial/greeting', (who) => {
        instr.emit({ type: 'log', pluginId, message: `heard greeting for ${who}` })
      })
    },
  }
}

const broadcasterPlugin = {
  name: 'greeting-broadcaster',
  apply(ctx: Context) {
    ctx.effect(() => {
      const timer = setInterval(() => {
        ctx.emit('tutorial/greeting', 'the tutorial')
      }, 2_000)
      return () => clearInterval(timer)
    }, 'greeting-broadcaster: interval')
  },
}

export const chapter: Chapter = {
  id: '04-events',
  title: 'Events',
  async run(instr) {
    const listenerFiber = instr.ctx.plugin(listenerPlugin(instr))
    const broadcasterFiber = instr.ctx.plugin(broadcasterPlugin)
    await Promise.all([listenerFiber, broadcasterFiber])
    return async () => {
      await broadcasterFiber.dispose()
      await listenerFiber.dispose()
    }
  },
}
