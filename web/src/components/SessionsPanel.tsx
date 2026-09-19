import { useEffect, useRef, useState } from "react";
import { Archive, Download, History, Pause, Play, RotateCcw, Upload } from "lucide-react";
import type { RecordedSession, WorkspaceBundle } from "@cordis-tutorial/shared";
import { useStore } from "../store";

/**
 * Continuity, unified: replay + on-disk archives + portable bundles +
 * clear-workspace, all in one place - not four separately-labeled panels a
 * user has to mentally stitch together (the design brief's own complaint
 * about the old layout). Logic ported as-is from the former
 * HistoryPanel.tsx; only the composition/markup changed.
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

export function SessionsPanel() {
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
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const chapterRunning = useStore((s) => s.chapterRunning);
  const agentRunning = useStore((s) => s.agentRunning);
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
    <div className="continuity">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">FILES + EVENTS</span>
          <h2>Session continuity</h2>
        </div>
      </div>

      <div className="replay-card">
        <div className="replay-card-head">
          <History />
          <span>
            <strong>{current ? sessionSummary(current) : "No live session yet"}</strong>
            <small>{replaying ? `Replay isolated · checkpoint ${Math.max(0, index + 1)} of ${total}` : "Live events are recorded automatically"}</small>
          </span>
        </div>
        <div className="timeline">
          <i style={{ width: replaying && total > 0 ? `${((index + 1) / total) * 100}%` : "100%" }} />
        </div>
        <div className="replay-controls">
          <button className="btn icon-btn" disabled={!replaying || index < 0} onClick={() => replayStep(-1)}>
            <RotateCcw size={13} />
          </button>
          <button
            className="btn primary icon-btn"
            disabled={!current || current.events.length === 0}
            onClick={() => {
              if (!replaying) replaySession(sessions.findIndex((s) => s.id === current?.id));
              setPlaying((v) => !v);
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          {replaying && (
            <button className="btn ghost" onClick={exitReplay}>
              exit replay
            </button>
          )}
          <span>
            {Math.max(0, index + 1)} / {total}
          </span>
        </div>
      </div>

      <div className="continuity-actions">
        <button
          className="btn outline"
          disabled={archiving || !current || current.events.length === 0}
          onClick={() => {
            setArchiveMessage("Archiving current workspace and history…");
            archiveCurrent(archiveTitle);
            setArchiveTitle("");
            window.setTimeout(() => setArchiveMessage(""), 2000);
          }}
        >
          <Archive size={14} /> Archive checkpoint
        </button>
        <button
          className="btn outline"
          disabled={!current || current.events.length === 0}
          onClick={() => {
            const bundle = exportBundle();
            if (bundle) downloadBundle(bundle);
          }}
        >
          <Download size={14} /> Export bundle
        </button>
        <button className="btn outline" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Import bundle
        </button>
        <button
          className="btn outline danger"
          disabled={chapterRunning || agentRunning}
          title="Wipe the real workspace files back to the starter state - export/archive first if you want to keep them"
          onClick={() => {
            if (window.confirm("Clear the workspace back to the starter files? Export a bundle or archive it first if you want to keep the current files.")) {
              resetWorkspace();
            }
          }}
        >
          <RotateCcw size={14} /> Clear workspace
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
      {archiveMessage && <div className="archive-message">{archiveMessage}</div>}

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
            <input className="archive-title-input" type="text" placeholder="title" value={archiveTitle} onChange={(e) => setArchiveTitle(e.target.value)} />
          </div>
        </div>
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

      <div className="history-section">
        <div className="history-section-head">
          <strong>past sessions</strong>
          <span className="hint">{sessions.length} recorded</span>
        </div>
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
