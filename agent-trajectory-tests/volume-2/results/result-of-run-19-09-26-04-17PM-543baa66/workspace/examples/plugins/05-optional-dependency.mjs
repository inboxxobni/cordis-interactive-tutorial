// Example: optional-dependency
// Teaches:  an OPTIONAL dependency is not listed in `inject`; read it with
//           ctx.get('name') and handle it being absent. This plugin never
//           goes PENDING because of `greeter`.
// Expect:   Fiber ACTIVE with or without a greeter service mounted.
// Docs:     docs/guide/part-06-services-and-inject.md (required vs optional)
export const name = 'example-optional-dependency'

export function apply(ctx) {
  const greeter = ctx.get('greeter')
  console.log(greeter ? `[example-optional] ${greeter.greet('optional')}` : '[example-optional] no greeter, using fallback')
}
