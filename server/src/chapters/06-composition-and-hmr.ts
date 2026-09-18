/**
 * Chapter 6: Composition and HMR.
 *
 * Real Cordis HMR is `Fiber.restart()` / `Fiber.update(config)` - the SAME
 * fiber (same uid, same identity) unloads its effects and re-runs apply(),
 * rather than being disposed and replaced. This is what a config-file watcher
 * (cordis.patch.yml re-touch) actually drives, and it's distinct from
 * mount_plugin's dispose+remount (which creates a genuinely NEW fiber for a
 * genuinely new file version - the right model for "the agent rewrote this
 * file", not for "the same plugin's config changed").
 *
 * Watch the pluginId in the trace: it does not change across the restart.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

let generation = 0

const versionedPlugin = {
  name: 'versioned-plugin',
  apply(ctx: Context, config: { label?: string } = {}) {
    generation += 1
    console.log(`[versioned-plugin] apply() ran, generation ${generation}, label=${config.label}`)
  },
}

export const chapter: Chapter = {
  id: '06-composition-and-hmr',
  title: 'Composition and HMR',
  async run({ ctx, emit }) {
    generation = 0
    const fiber = ctx.plugin(versionedPlugin, { label: 'v1' })
    await fiber.await()

    await new Promise((r) => setTimeout(r, 800))

    // fiber.update() is Cordis's real HMR entry point: validate the new
    // config, then restart in place. Same fiber, same identity.
    emit({ type: 'hmr_reload', pluginId: `${fiber.name}#${fiber.uid}` })
    await fiber.update({ label: 'v2 (hot-reloaded)' })

    return () => fiber.dispose()
  },
}
