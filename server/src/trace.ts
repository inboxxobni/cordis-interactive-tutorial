/** The trace emit function: every step of the loop reports itself via this. */
import type { TraceEvent } from '@cordis-tutorial/shared'

export type Emit = (event: TraceEvent) => void
