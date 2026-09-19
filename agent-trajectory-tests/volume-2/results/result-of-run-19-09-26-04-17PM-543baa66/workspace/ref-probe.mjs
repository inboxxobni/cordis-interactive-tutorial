// ref-probe.mjs - retired: it existed only to read the clipped middle of the
// reference llm.mjs from disk. Kept as a no-op so the canvas node does not sit
// in FAILED; it owns no effects and provides nothing.
// Expect: ACTIVE.
export const name = 'ref-probe'

export function apply() {
  console.log('[ref-probe] retired - no-op')
}
