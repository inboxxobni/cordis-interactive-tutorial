/** Truncate long tool output so it does not blow up the context window. */
export function clip(s: string, max = 4000): string {
  if (s.length <= max) return s
  const head = s.slice(0, Math.floor(max / 2))
  const tail = s.slice(-Math.floor(max / 2))
  return `${head}\n\n...[clipped ${s.length - max} chars]...\n\n${tail}`
}
