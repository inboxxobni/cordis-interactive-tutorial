import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "../store";

/**
 * A real terminal (xterm.js, https://github.com/xtermjs/xterm.js/) backed
 * by a real shell (node-pty on the server, cwd'd at the actual workspace
 * directory) - so you can `ls`, `cat`, `pnpm install`, and `node run.mjs`
 * the agent's generated Cordis plugins directly, the same files the file
 * tree and mount_plugin see, not a simulated console.
 */
export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastSeq = useRef(0);

  const connected = useStore((s) => s.connected);
  const terminalRunning = useStore((s) => s.terminalRunning);
  const terminalShell = useStore((s) => s.terminalShell);
  const startTerminal = useStore((s) => s.startTerminal);
  const stopTerminal = useStore((s) => s.stopTerminal);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      convertEol: true,
      fontSize: 12,
      fontFamily: "JetBrains Mono, SF Mono, Fira Code, Menlo, Consolas, monospace",
      theme: { background: "#0d0f13" },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => useStore.getState().sendTerminalInput(data));

    const onResize = () => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      useStore.getState().resizeTerminal(termRef.current.cols, termRef.current.rows);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Starting on mount alone races the WebSocket: the socket is usually
  // still CONNECTING when this component first renders, so `terminal_start`
  // would silently drop (TutorialSocket.send() no-ops until OPEN) - the same
  // class of race this project already hit with the server's own ws.on
  // listener. Re-fire once `connected` actually flips true instead.
  useEffect(() => {
    if (connected && !terminalRunning && termRef.current) {
      startTerminal(termRef.current.cols, termRef.current.rows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    const chunk = useStore.getState().terminalChunk;
    if (chunk && chunk.seq > lastSeq.current) {
      lastSeq.current = chunk.seq;
      termRef.current?.write(chunk.data);
    }
    return useStore.subscribe((state) => {
      const c = state.terminalChunk;
      if (c && c.seq > lastSeq.current) {
        lastSeq.current = c.seq;
        termRef.current?.write(c.data);
      }
    });
  }, []);

  return (
    <div className="side-panel terminal-panel">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot" /> terminal
        </span>
        <span className="panel-meta">{terminalRunning ? terminalShell ?? "running" : "stopped"}</span>
      </div>
      <div className="terminal-toolbar">
        <span className="hint">Real shell, cwd&apos;d at the real workspace directory.</span>
        <span className="spacer" />
        {terminalRunning ? (
          <button className="btn ghost danger" onClick={stopTerminal}>
            stop
          </button>
        ) : (
          <button
            className="btn ghost"
            onClick={() => {
              const term = termRef.current;
              if (term) startTerminal(term.cols, term.rows);
            }}
          >
            restart
          </button>
        )}
      </div>
      <div ref={containerRef} className="terminal-surface" />
    </div>
  );
}
