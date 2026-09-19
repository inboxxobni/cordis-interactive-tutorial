// Example: capability-provider-shout  (role 2 of 3: an alternative Provider)
// Teaches:  a second implementation of the SAME service, to show the consumer
//           keeps working when the provider is replaced.
// Expect:   Fiber ACTIVE once the local provider is disposed first.
// Docs:     docs/guide/part-14-three-role-capability.md, part-06 (dynamic provider replacement)
import { UppercaseService } from './13-capability-definition.mjs'

export const name = 'example-uppercase-shout'

export class UppercaseShoutProvider extends UppercaseService {
  async execute({ input }) {
    return { output: `${input.toUpperCase()}!!!` }
  }
}

export { UppercaseShoutProvider as apply }
