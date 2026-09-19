import { useState } from "react";
import { Moon, MonitorCog, Settings2, Sun } from "lucide-react";
import { PROVIDERS } from "@cordis-tutorial/shared";
import { useStore } from "../store";
import { SettingsPanel } from "./SettingsPanel";
import { shortenPath } from "./Workspace";

export type ThemeMode = "light" | "dark" | "system";

/**
 * The chrome: brand, real runtime health (connection state, session id,
 * workspace path - nothing fabricated), the theme toggle, and the settings
 * gear. Provider configure/test/wipe controls live only in SettingsPanel
 * now (they were duplicated here before) - this strip is read-only status,
 * not a second copy of the settings form.
 */
export function Header({ theme, onThemeChange }: { theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void }) {
  const connected = useStore((s) => s.connected);
  const sessionId = useStore((s) => s.sessionId);
  const workspacePath = useStore((s) => s.workspacePath);
  const activeProvider = useStore((s) => s.activeProvider);
  const configured = useStore((s) => s.configured);
  const providerConfigs = useStore((s) => s.providerConfigs);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const info = PROVIDERS.find((p) => p.id === activeProvider)!;
  const cfg = providerConfigs[activeProvider];

  return (
    <header className="global-header">
      <div className="brand-title">
        <span className="brand-mark">◆</span>
        <div>
          <strong>CORDIS INTERACTIVE TUTORIAL</strong>
          <span>a real, instrumented Context</span>
        </div>
      </div>

      <div className="runtime-strip">
        <span className={`health${connected ? "" : " offline"}`}>
          <span className="status-dot" /> {connected ? "CONTEXT CONNECTED" : "CONNECTING…"}
        </span>
        {sessionId && (
          <span>
            <b>SESSION</b> {sessionId.slice(0, 8)}
          </span>
        )}
        {workspacePath && (
          <span className="path" title={workspacePath}>
            {shortenPath(workspacePath)}
          </span>
        )}
        <span className="active-config" title="Exactly what the agent will use on the next run">
          {info.label} · {cfg?.model || info.models[0] || "—"} · {configured ? "ready" : "not connected"}
        </span>
      </div>

      <div className="header-actions">
        <div className="theme-control" aria-label="Appearance">
          <button aria-label="Light mode" className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")}>
            <Sun size={13} />
          </button>
          <button aria-label="System appearance" className={theme === "system" ? "active" : ""} onClick={() => onThemeChange("system")}>
            <MonitorCog size={13} />
          </button>
          <button aria-label="Dark mode" className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")}>
            <Moon size={13} />
          </button>
        </div>
        <button className="btn ghost icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={15} />
        </button>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
