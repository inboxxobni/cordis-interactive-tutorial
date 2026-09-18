import { createInstrumentedContext } from '../src/cordis-instrumentation.js'
import { chapter } from '../src/chapters/05-configuration.js'

const instr = createInstrumentedContext((e) => console.log(e.type, JSON.stringify(e).slice(0, 200)))
console.log('starting chapter.run...')
const teardown = await chapter.run(instr)
console.log('chapter.run resolved')
await teardown()
console.log('teardown resolved')
process.exit(0)
