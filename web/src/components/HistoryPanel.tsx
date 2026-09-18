import { useEffect, useRef, useState } from "react";
import type { RecordedSession, WorkspaceBundle } from "@cordis-tutorial/shared";
import { useStore } from "../store";

/**
 * History / replay + on-disk archives, ported from aicodingagent-ts's
 * HistoryPanel.tsx: continuous auto-recording (no manual "save session"
 * step - see store.ts's apply()), step-through replay with a scrubbable
 * timeline, and a combined archive (real workspace files + the paired event
 * history bundled together, not two separate save flows).
 *
 * Export/import work on that same combined shape (WorkspaceBundle: files +
 * history together) - a single portable .json file, not two separate
 * exports. There is no reason to ever export one without the other.
 */
function downloadBundle(bundle: WorkspaceBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${bundle.history.id}.bundle.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseImportedBundle(raw: string): WorkspaceBundle {
  const value = JSON.parse(raw) as unknown;
  const bundle = value as Partial<WorkspaceBundle>;
  if (!bundle || typeof bundle !== "object" || bundle.version !== 1 || !bundle.history || !Array.isArray(bundle.history.events) || !bundle.files) {
    throw new Error("Invalid Cordis Tutorial bundle file (expected { version: 1, history, files }).");
  }
  return bundle as WorkspaceBundle;
}

function sessionSummary(session: RecordedSession): string {
  const chapters = session.events.filter((e) => e.type === "chapter_start").length;
  const turns = session.events.filter((e) => e.type === "turn_start").length;
  const parts: string[] = [];
  if (chapters > 0) parts.push(`${chapters} chapter(s)`);
  if (turns > 0) parts.push(`${turns} turn(s)`);
  parts.push(`${session.events.length} event(s)`);
  return parts.join(" · ");
}

export function HistoryPanel() {
  const sessions = useStore((s) => s.historySessions);
  const current = useStore((s) => s.currentSession);
  const replaying = useStore((s) => s.replaying);
  const index = useStore((s) => s.replayEventIndex);
  const replaySession = useStore((s) => s.replaySession);
  const replayStep = useStore((s) => s.replayStep);
  const exitReplay = useStore((s) => s.exitReplay);
  const exportBundle = useStore((s) => s.exportBundle);
  const restoreBundle = useStore((s) => s.restoreBundle);
  const archives = useStore((s) => s.archives);
  const archiving = useStore((s) => s.archiving);
  const listArchives = useStore((s) => s.listArchives);
  const archiveCurrent = useStore((s) => s.archiveCurrent);
  const loadArchive = useStore((s) => s.loadArchive);
  const [playing, setPlaying] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archiveMessage, setArchiveMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listArchives();
  }, [listArchives]);

  useEffect(() => {
    if (!playing || !current) return;
    const timer = window.setInterval(() => {
      const state = useStore.getState();
      if (!state.currentSession || state.replayEventIndex >= state.currentSession.events.length - 1) {
        setPlaying(false);
      } else {
        state.replayStep(1);
      }
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing, current]);

  const selectedIndex = current ? sessions.findIndex((s) => s.id === current.id) : -1;
  const total = current?.events.length ?? 0;

  return (
    <div className="side-panel history-panel">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot" /> history / replay
        </span>
        <span className="panel-meta">{sessions.length} sessions</span>
      </div>

      <div className="history-toolbar">
        {!replaying ? (
          <span className="hint">Live events are recorded automatically. Export/import bundle files + history together - not separately.</span>
        ) : (
          <>
            <button className="btn" onClick={() => replayStep(-1)} disabled={index < 0}>
              ← prev
            </button>
            <button className="btn primary" onClick={() => setPlaying((v) => !v)}>
              {playing ? "❚❚ pause" : "▶ play"}
            </button>
            <button className="btn" onClick={() => replayStep(1)} disabled={!current || index >= total - 1}>
              next →
            </button>
            <span className="panel-meta">
              {Math.max(0, index + 1)} / {total}
            </span>
            <button className="btn ghost" onClick={exitReplay}>
              exit replay
            </button>
          </>
        )}
        <span className="spacer" />
        <button
          className="btn ghost"
          title="Download the current workspace files + history together, as one .json file"
          onClick={() => {
            const bundle = exportBundle();
            if (bundle) downloadBundle(bundle);
          }}
          disabled={!current || current.events.length === 0}
        >
          export bundle
        </button>
        <button className="btn ghost" title="Restore files + history from a bundle .json file" onClick={() => fileRef.current?.click()}>
          import bundle
        </button>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file
              .text()
              .then((text) => restoreBundle(parseImportedBundle(text)))
              .catch((err) => window.alert(String(err)));
            e.target.value = "";
          }}
        />
      </div>

      <div className="archive-section">
        <div className="archive-head">
          <div>
            <strong>workspace archives</strong>
            <span>real files + paired history · stored in .archives/</span>
          </div>
          <div className="archive-actions">
            <button className="btn ghost" onClick={listArchives}>
              refresh
            </button>
            <input
              className="archive-title-input"
              type="text"
              placeholder="title"
              value={archiveTitle}
              onChange={(e) => setArchiveTitle(e.target.value)}
            />
            <button
              className="btn primary"
              disabled={archiving || !current || current.events.length === 0}
              onClick={() => {
                setArchiveMessage("Archiving current workspace and history…");
                archiveCurrent(archiveTitle);
                setArchiveTitle("");
                window.setTimeout(() => setArchiveMessage(""), 2000);
              }}
            >
              archive current
            </button>
          </div>
        </div>
        {archiveMessage && <div className="archive-message">{archiveMessage}</div>}
        <div className="archive-list">
          {archives.length === 0 ? (
            <div className="hint">No archives yet. Run a chapter or the agent, then archive it.</div>
          ) : (
            archives.map((archive) => (
              <div key={archive.id} className="archive-item">
                <div>
                  <strong>{archive.title}</strong>
                  <span>
                    {new Date(archive.archivedAt).toLocaleString()} · {archive.fileCount} files · {archive.turns} turns · {archive.events} events
                  </span>
                  <small>{archive.id}</small>
                </div>
                <button
                  className="btn"
                  disabled={archiving}
                  onClick={() => {
                    setArchiveMessage(`Loading ${archive.title}…`);
                    loadArchive(archive.id);
                    window.setTimeout(() => setArchiveMessage(""), 2000);
                  }}
                >
                  load
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="history-body">
        <div className="history-list">
          {sessions.length === 0 && <div className="ws-empty">Run a chapter or the agent once and every event will be replayable here.</div>}
          {sessions.map((session, i) => (
            <button
              key={session.id}
              className={`history-session${selectedIndex === i ? " active" : ""}`}
              onClick={() => {
                setPlaying(false);
                replaySession(i);
              }}
            >
              <strong>{new Date(session.createdAt).toLocaleTimeString()}</strong>
              <span>{sessionSummary(session)}</span>
              <small title={session.workspacePath}>{session.workspacePath || "workspace unavailable"}</small>
            </button>
          ))}
        </div>
        {replaying && current && (
          <div className="history-timeline">
            {current.events.map((event, i) => (
              <button
                key={`${i}-${event.type}`}
                className={`history-event${i === index ? " active" : ""}${i < index ? " passed" : ""}`}
                title={event.type}
                onClick={() => {
                  const delta = i - useStore.getState().replayEventIndex;
                  if (delta !== 0) replayStep(delta);
                }}
              >
                <span>{i + 1}</span>
                {event.type.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
