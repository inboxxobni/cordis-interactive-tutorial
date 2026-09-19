// Example: service-consumer
// Teaches:  `inject` is a HARD dependency. Until something provides `greeter`
//           this fiber stays PENDING (healthy, not broken). The moment
//           03-service-class.mjs is mounted it flips to ACTIVE by itself,
//           whichever was mounted first.
// Expect:   mounted alone: PENDING. After 03-service-class.mjs: ACTIVE.
// Docs:     docs/guide/part-06-services-and-inject.md, part-04 (PENDING is not an error)
export const name = 'example-service-consumer'
export const inject = ['greeter']

export function apply(ctx) {
  console.log(`[example-service-consumer] ${ctx.greeter.greet('consumer')}`)
}
