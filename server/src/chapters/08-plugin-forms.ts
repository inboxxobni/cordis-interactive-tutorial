/**
 * Chapter 8: Your first ACRYL Harness plugin.
 *
 * Cordis (and ACRYL's own conventions on top of it) accept a plugin in three
 * legal shapes - function, object literal, and class. All three are mounted
 * here so you can see they behave identically: same lifecycle, same
 * fiber_state_change sequence, same everything except syntax.
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

// Shape 1: function - the default, use this until you need to *provide* a
// named service (see chapter 3 and chapter 13).
function functionApply(ctx: Context) {
  console.log('[function-form] apply() ran')
}
const functionPlugin = { name: 'plugin-form-function', apply: functionApply }

// Shape 2: object literal - identical to the function form, just written
// inline. Useful when you want to attach other static fields (Config,
// inject) without a separate `export const` per field.
const objectPlugin = {
  name: 'plugin-form-object',
  apply(ctx: Context) {
    console.log('[object-form] apply() ran')
  },
}

// Shape 3: class - extends Service when the plugin's whole point is to
// *provide* a named capability (see the three-role capability chapter). The
// constructor's `super(ctx, name)` is what registers it as `ctx.<name>`.
class ClassFormService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'pluginFormClass')
    console.log('[class-form] constructor ran (this is apply(), for a Service class)')
  }
}
const classPlugin = ClassFormService

export const chapter: Chapter = {
  id: '08-plugin-forms',
  title: 'Your first ACRYL Harness plugin',
  async run({ ctx }) {
    const fibers = [ctx.plugin(functionPlugin), ctx.plugin(objectPlugin), ctx.plugin(classPlugin)]
    await Promise.all(fibers.map((f) => f.await()))
    return async () => {
      await Promise.all(fibers.map((f) => f.dispose()))
    }
  },
}
