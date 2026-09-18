import { useState } from "react";
import { PROVIDERS } from "@cordis-tutorial/shared";
import { useStore } from "../store";
import { SettingsPanel } from "./SettingsPanel";

export function TopBar() {
  const connected = useStore((s) => s.connected);
  const activeProvider = useStore((s) => s.activeProvider);
  const configured = useStore((s) => s.configured);
  const testing = useStore((s) => s.testing);
  const testResult = useStore((s) => s.testResult);
  const providerConfigs = useStore((s) => s.providerConfigs);
  const configure = useStore((s) => s.configure);
  const testConnection = useStore((s) => s.testConnection);
  const wipe = useStore((s) => s.wipe);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const chapterRunning = useStore((s) => s.chapterRunning);
  const agentRunning = useStore((s) => s.agentRunning);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const info = PROVIDERS.find((p) => p.id === activeProvider)!;
  const cfg = providerConfigs[activeProvider];

  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo">
          Cordis <span>Tutorial</span>
        </span>
        <span className="tag">a real, instrumented Context - learn it, then build on it</span>
      </div>

      <span className={`conn-dot${connected ? " on" : ""}`} title={connected ? "connected" : "disconnected"} />

      <button className="btn primary" onClick={() => setSettingsOpen(true)}>
        ⚙ settings
      </button>

      <button className="btn ghost" disabled={!configured || testing} onClick={testConnection} title="Send one real request to confirm the key and model work">
        {testing ? "⟳ testing" : "▶ test"}
      </button>

      {!configured && cfg?.apiKey && (
        <button className="btn ghost" disabled={!connected} onClick={configure}>
          connect
        </button>
      )}

      <button
        className="btn ghost danger"
        disabled={chapterRunning || agentRunning}
        title="Wipe the real workspace files back to the starter state - export/archive first if you want to keep them"
        onClick={() => {
          if (window.confirm("Clear the workspace back to the starter files? Export a bundle or archive it first if you want to keep the current files.")) {
            resetWorkspace();
          }
        }}
      >
        clear workspace
      </button>

      <button className="btn ghost danger" onClick={wipe} title="Wipe all saved provider credentials from this browser">
        wipe saved
      </button>

      {testResult && (
        <span className={`test-indicator ${testResult.ok ? "ok" : "fail"}`} title={testResult.message}>
          <span className="test-dot" />
          <span className="test-msg">{testResult.message}</span>
        </span>
      )}

      <div className="active-config" title="Exactly what the agent will use on the next run">
        <span className="ac-label">active</span>
        <span className="ac-value">
          {info.label} · {cfg?.model || info.models[0] || "—"}
        </span>
        {configured ? <span className="ac-ok">✓ configured</span> : <span className="ac-warn">not connected</span>}
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
