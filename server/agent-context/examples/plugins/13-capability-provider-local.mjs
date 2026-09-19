// Example: capability-provider-local  (role 2 of 3: Provider)
// Teaches:  one concrete implementation of the definition. Swappable: the
//           consumer never imports this file.
// Expect:   Fiber ACTIVE; service `uppercase` resolves.
// Docs:     docs/guide/part-14-three-role-capability.md
import { UppercaseService } from './13-capability-definition.mjs'

export const name = 'example-uppercase-local'

export class UppercaseLocalProvider extends UppercaseService {
  async execute({ input }) {
    return { output: input.toUpperCase() }
  }
}

export { UppercaseLocalProvider as apply }
