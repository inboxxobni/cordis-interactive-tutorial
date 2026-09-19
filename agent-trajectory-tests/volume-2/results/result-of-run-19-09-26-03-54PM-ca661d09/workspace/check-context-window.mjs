export const name = 'check-context-window'
export const inject = ['contextWindow']

// Throwaway self-check: the fiber goes ACTIVE only if every assertion
// below holds, so its real state is the evidence - not my prose about it.
export function apply(ctx) {
  const cw = ctx.contextWindow
  const assert = (cond, label) => {
    if (!cond) throw new Error(`assertion failed: ${label}`)
  }

  const m1 = { role: 'system', content: 'sys' }
  const m2 = { role: 'user', content: 'hello' }
  const m3 = { role: 'assistant', content: 'hi' }
  const m3b = { role: 'assistant', content: 'HELLO' }

  assert(cw.estimateTokens([]) === 0, 'empty -> 0 tokens')
  assert(cw.estimateTokens([{ role: 'user', content: 'a'.repeat(400) }]) === 100, '400 chars -> 100')
  assert(cw.estimateTokens([{ role: 'user', content: 'abcde' }]) === 2, 'ceil(5/4) = 2')
  assert(
    cw.estimateTokens([{ role: 'user', content: [{ type: 'text', text: 'a'.repeat(40) }] }]) === 10,
    'array content parts counted',
  )
  assert(
    cw.estimateTokens([{ role: 'assistant', content: null, tool_calls: [{ id: 'x', function: { name: 'n', arguments: '{}' } }] }]) > 0,
    'tool_calls counted',
  )

  assert(cw.sharedPrefixLength([], []) === 0, 'both empty')
  assert(cw.sharedPrefixLength([m1, m2, m3], [m1, m2, m3], ) === 3, 'identical arrays')
  assert(cw.sharedPrefixLength([m1, m2, m3], [m1, m2, m3b]) === 2, 'diverges at index 2')
  assert(cw.sharedPrefixLength([m1, m2], [m1]) === 1, 'shorter current array')
  assert(cw.sharedPrefixLength([m3], [m1]) === 0, 'diverge at index 0')
  assert(cw.sharedPrefixLength(null, [m1]) === 0, 'non-array input tolerated')

  console.log('[check-context-window] all contextWindow assertions passed')
}
