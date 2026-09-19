// Example: capability-definition  (role 1 of 3: Service Definition)
// Teaches:  the abstract shape of a capability. NOT a plugin: it has no
//           apply(), so it is never mounted. Providers extend it; consumers
//           depend only on the service NAME.
// Expect:   not mounted (imported by 13-capability-provider-*.mjs).
// Docs:     docs/guide/part-14-three-role-capability.md
import { Service } from '@deepseek-ai/cordis'

export class UppercaseService extends Service {
  constructor(ctx) {
    super(ctx, 'uppercase')
  }

  async execute(_request) {
    throw new Error('UppercaseService.execute must be implemented by a provider')
  }
}
