// Example: capability-consumer  (role 3 of 3: Consumer)
// Teaches:  depends on the service NAME only. PENDING until a provider exists;
//           re-activates when the provider identity changes.
// Expect:   mounted alone: PENDING. With a provider: ACTIVE and logs the result.
// Docs:     docs/guide/part-14-three-role-capability.md
export const name = 'example-capability-consumer'
export const inject = ['uppercase']

export async function apply(ctx) {
  const { output } = await ctx.uppercase.execute({ input: 'three-role capability' })
  console.log(`[example-capability-consumer] got: ${output}`)
}
