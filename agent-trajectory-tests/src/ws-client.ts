import WebSocket from "ws";
import type { ChapterId, ClientMessage, ProviderId, TraceEvent } from "@cordis-tutorial/shared";

/**
 * A thin client over the exact same WebSocket protocol the real browser UI
 * uses (shared/index.ts's ClientMessage/TraceEvent) - the harness is not a
 * second implementation of the agent, it drives the real one, exactly like
 * a real user clicking a real suggestion chip would. One instance = one
 * live session against one running server, matching one browser tab.
 */
export class TrajectoryClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private buffered: TraceEvent[] = [];
  private listeners: Array<(e: TraceEvent) => void> = [];

  constructor(private readonly serverUrl: string) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      this.ws = ws;
      const onFirstEvent = (event: TraceEvent) => {
        if (event.type === "session_start") {
          this.sessionId = event.sessionId;
          this.off(onFirstEvent);
          resolve();
        }
      };
      ws.on("open", () => {
        this.on(onFirstEvent);
      });
      ws.on("message", (raw) => {
        const event = JSON.parse(raw.toString()) as TraceEvent;
        this.buffered.push(event);
        for (const l of this.listeners) l(event);
      });
      ws.on("error", reject);
      ws.on("close", () => {
        if (!this.sessionId) reject(new Error("connection closed before session_start"));
      });
    });
  }

  close(): void {
    this.ws?.close();
  }

  private on(fn: (e: TraceEvent) => void): void {
    this.listeners.push(fn);
  }

  private off(fn: (e: TraceEvent) => void): void {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) throw new Error("not connected");
    this.ws.send(JSON.stringify(msg));
  }

  configure(provider: ProviderId, model: string, apiKey: string, baseURL?: string): void {
    this.send({ type: "configure", provider, model, apiKey, baseURL });
  }

  /** Mirrors what clicking a chapter in the left rail sends - sets server-side activeChapter state before feeding that chapter's chain. */
  runChapter(chapter: ChapterId): void {
    this.send({ type: "run_chapter", chapter });
  }

  resetWorkspace(): Promise<void> {
    return new Promise((resolve) => {
      const onEvent = (event: TraceEvent) => {
        if (event.type === "workspace_reset") {
          this.off(onEvent);
          resolve();
        }
      };
      this.on(onEvent);
      this.send({ type: "reset_workspace" });
    });
  }

  /**
   * Feeds one prompt (one suggestion chip) and waits for the real turn to
   * settle - a `status: done` or `status: error` TraceEvent, exactly the
   * signal the real UI's agentStatus reducer waits on. Returns every event
   * produced by this turn, in order.
   */
  runTurn(message: string, timeoutMs: number): Promise<{ status: "done" | "error" | "timeout"; events: TraceEvent[] }> {
    return new Promise((resolve) => {
      const events: TraceEvent[] = [];
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.off(onEvent);
        resolve({ status: "timeout", events });
      }, timeoutMs);

      const onEvent = (event: TraceEvent) => {
        events.push(event);
        if (event.type === "status" && (event.status === "done" || event.status === "error")) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.off(onEvent);
          resolve({ status: event.status, events });
        }
      };
      this.on(onEvent);
      this.send({ type: "run", message });
    });
  }

  /** The real, current workspace file list + full content snapshot, fetched over the same REST endpoints Workspace.tsx uses - not re-derived from trace events. */
  async workspaceSnapshot(httpBaseUrl: string): Promise<{ files: string[]; snapshot: Record<string, string> }> {
    if (!this.sessionId) throw new Error("not connected");
    const res = await fetch(`${httpBaseUrl}/api/workspace/snapshot?session=${this.sessionId}`);
    if (!res.ok) throw new Error(`workspace snapshot fetch failed: ${res.status}`);
    return (await res.json()) as { workspacePath: string; files: string[]; snapshot: Record<string, string> };
  }
}
