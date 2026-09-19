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
export function TerminalPanel({ visible = true }: { visible?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastSeq = useRef(0);

  const connected = useStore((s) => s.connected);
  const terminalRunning = useStore((s) => s.terminalRunning);
  const terminalShell = useStore((s) => s.terminalShell);
  const startTerminal = useStore((s) => s.startTerminal);
  const stopTerminal = useStore((s) => s.stopTerminal);

  // xterm.js measures its character-cell size from the DOM at the moment
  // `term.open()` runs, and gets that measurement permanently wrong if the
  // container is `display:none` at the time (a well-known xterm.js
  // limitation) - which it always was here, because this panel now lives in
  // a workbench tab that's mounted (for scrollback continuity across tab
  // switches) before it's ever the visible tab. The real symptom was
  // exactly this: the panel rendered, but typed input never registered,
  // because the hidden helper textarea xterm uses to capture keystrokes was
  // sized against a zero-size box. Fix: don't call `open()` until this
  // panel is visible for real, the first time - not on React mount.
  useEffect(() => {
    if (!visible || termRef.current || !containerRef.current) return;
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
    term.focus();

    term.onData((data) => useStore.getState().sendTerminalInput(data));

    if (useStore.getState().connected && !useStore.getState().terminalRunning) {
      useStore.getState().startTerminal(term.cols, term.rows);
    }

    const onResize = () => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      useStore.getState().resizeTerminal(termRef.current.cols, termRef.current.rows);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, []);

  // Starting the very first time races the WebSocket (handled above once
  // the terminal actually opens) - but if `connected` flips from false to
  // true AFTER the terminal already opened (e.g. a reconnect), re-fire here
  // too, the same race this project already hit with the server's own
  // ws.on listener.
  useEffect(() => {
    if (connected && !terminalRunning && termRef.current) {
      startTerminal(termRef.current.cols, termRef.current.rows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Re-fit on every later visibility change too (switching back to this
  // tab after the window itself was resized while it was hidden).
  useEffect(() => {
    if (!visible || !fitRef.current || !termRef.current) return;
    fitRef.current.fit();
    termRef.current.focus();
    useStore.getState().resizeTerminal(termRef.current.cols, termRef.current.rows);
  }, [visible]);

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
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <span className="hint">
          Real shell, cwd&apos;d at the real workspace directory · {terminalRunning ? terminalShell ?? "running" : "stopped"}
        </span>
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
