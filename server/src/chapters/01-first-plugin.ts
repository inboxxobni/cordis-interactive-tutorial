/**
 * Chapter 1: Your first plugin.
 *
 * The smallest legal Cordis plugin is a module exporting `apply`. Cordis
 * calls it once the fiber becomes ACTIVE - there's no separate bootstrap
 * step, `ctx.plugin()` IS the bootstrap.
 */
import type { Chapter } from './types.js'

const helloPlugin = {
  name: 'hello-world',
  apply(_ctx: unknown) {
    // In a real plugin this is where capabilities get registered. Chapter 1
    // deliberately does nothing else - the point is watching this single
    // plugin_register + fiber_state_change(PENDING -> ... -> ACTIVE) pair
    // happen for real, with no services or dependencies in the way.
  },
}

export const chapter: Chapter = {
  id: '01-first-plugin',
  title: 'Your first plugin',
  async run({ ctx }) {
    const fiber = ctx.plugin(helloPlugin)
    await fiber
    return () => fiber.dispose()
  },
}
