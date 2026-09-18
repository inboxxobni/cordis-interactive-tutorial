/**
 * AgentControl - the stop gate. Trimmed from Agent Loop's version: this
 * prototype has no pause/step/approval UI, just start/stop.
 */
export class StopSignal extends Error {
  constructor() {
    super('Agent stopped by user')
    this.name = 'StopSignal'
  }
}

export class AgentControl {
  private stopped = false

  isStopped(): boolean {
    return this.stopped
  }

  stop(): void {
    this.stopped = true
  }

  async gate(): Promise<void> {
    if (this.stopped) throw new StopSignal()
  }
}
