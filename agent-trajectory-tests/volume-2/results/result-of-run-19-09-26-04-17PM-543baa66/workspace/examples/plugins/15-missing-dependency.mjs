// Example: missing-dependency
// Teaches:  diagnosing PENDING: `cordis_inspect_query` shows the unmet
//           service by name. The fix is to PROVIDE `nonexistent-service`,
//           never to delete the inject.
// Expect:   Fiber PENDING (permanently, until something provides the service).
// Docs:     docs/guide/part-17-debugging.md, part-04 (PENDING is not an error)
export const name = 'example-missing-dependency'
export const inject = ['nonexistent-service']

export function apply() {
  console.log('[example-missing-dependency] this line never runs while the dependency is missing')
}
