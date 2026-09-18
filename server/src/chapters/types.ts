import type { ChapterId } from '@cordis-tutorial/shared'
import type { Instrumented } from '../cordis-instrumentation.js'

export type Teardown = () => Promise<void> | void

export interface Chapter {
  id: ChapterId
  title: string;
  /** Runs the chapter's real plugins against the instrumented Context, and returns a teardown that disposes everything it mounted. */
  run(instr: Instrumented): Promise<Teardown>
}
