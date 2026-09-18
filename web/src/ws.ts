/**
 * WebSocket client for the tutorial server.
 *
 * In dev Vite proxies /ws to the server on 8788; in production the server
 * serves the frontend itself, so the WebSocket is same-origin.
 */
import type { ClientMessage, TraceEvent } from "@cordis-tutorial/shared";

export class TutorialSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onEvent: (e: TraceEvent) => void;
  private onOpen: () => void;
  private onClose: () => void;

  constructor(opts: {
    onEvent: (e: TraceEvent) => void;
    onOpen: () => void;
    onClose: () => void;
  }) {
    this.onEvent = opts.onEvent;
    this.onOpen = opts.onOpen;
    this.onClose = opts.onClose;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${proto}//${window.location.host}/ws`;
  }

  connect(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) return;
    }
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.onOpen();
    this.ws.onclose = () => {
      this.onClose();
      window.setTimeout(() => this.connect(), 1500);
    };
    this.ws.onmessage = (ev) => {
      try {
        const evt = JSON.parse(ev.data as string) as TraceEvent;
        this.onEvent(evt);
      } catch {
        // ignore malformed
      }
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
