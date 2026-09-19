// Example: service-class
// Teaches:  the class form. A Service subclass calls super(ctx, 'name') and is
//           thereby provided as ctx.<name> (here ctx.greeter). Export the class
//           as `apply`: its constructor is what runs as apply().
// Expect:   Fiber ACTIVE; service `greeter` resolves afterwards.
// Docs:     docs/guide/part-06-services-and-inject.md
import { Service } from '@deepseek-ai/cordis'

export const name = 'example-greeter-service'

export class GreeterService extends Service {
  constructor(ctx) {
    super(ctx, 'greeter')
    console.log('[greeter] provided')
  }

  greet(who) {
    return `Hello, ${who}!`
  }
}

export { GreeterService as apply }
