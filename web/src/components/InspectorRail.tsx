import { useState } from "react";
import { Bot, History, Network } from "lucide-react";
import { AgentConsole } from "./AgentConsole";
import { EventLog } from "./EventLog";
import { SessionsPanel } from "./SessionsPanel";

type InspectorTab = "agent" | "trace" | "sessions";

/**
 * Right rail: Agent (the real build agent chat), Trace (the raw real-time
 * WebSocket event feed, full detail), and Sessions (replay + archives +
 * bundles + clear-workspace, unified in one place instead of four separate
 * panels a user had to mentally stitch together).
 */
export function InspectorRail() {
  const [tab, setTab] = useState<InspectorTab>("agent");
  return (
    <aside className="right-rail">
      <div className="inspector-tabs">
        <button className={tab === "agent" ? "active" : ""} onClick={() => setTab("agent")}>
          <Bot size={13} /> Agent
        </button>
        <button className={tab === "trace" ? "active" : ""} onClick={() => setTab("trace")}>
          <Network size={13} /> Trace
        </button>
        <button className={tab === "sessions" ? "active" : ""} onClick={() => setTab("sessions")}>
          <History size={13} /> Sessions
        </button>
      </div>

      <div className="inspector-content" hidden={tab !== "agent"}>
        <AgentConsole />
      </div>
      <div className="inspector-content" hidden={tab !== "trace"}>
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">RAW TRUTH</span>
            <h2>Event inspector</h2>
          </div>
        </div>
        <EventLog variant="panel" />
      </div>
      <div className="inspector-content" hidden={tab !== "sessions"}>
        <SessionsPanel />
      </div>
    </aside>
  );
}
