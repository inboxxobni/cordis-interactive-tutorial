// Example: deliberate-failure
// Teaches:  what FAILED looks like: apply() throws, the error is real and is
//           reported by mount_plugin. Fix the actual bug; do not retry unchanged.
// Expect:   Fiber FAILED with error containing "deliberate failure".
// Docs:     docs/guide/part-17-debugging.md
export const name = 'example-deliberate-failure'

export function apply() {
  throw new Error('deliberate failure: this example exists to show a FAILED fiber')
}
