import { useEffect } from "react";
import { useStore } from "./store";
import { TopBar } from "./components/TopBar";
import { Navigator } from "./components/Navigator";
import { AgentConsole } from "./components/AgentConsole";
import { PluginGraph } from "./components/PluginGraph";
import { EventLog } from "./components/EventLog";
import { Theory } from "./components/Theory";
import { SourceView } from "./components/SourceView";
import { Workspace } from "./components/Workspace";
import { HistoryPanel } from "./components/HistoryPanel";
import { TerminalPanel } from "./components/Terminal";

export function App() {
  const connect = useStore((s) => s.connect);
  const activeChapter = useStore((s) => s.activeChapter);

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="app">
      <TopBar />
      <div className="layout">
        <Navigator />
        <aside>
          <AgentConsole />
        </aside>
        <main>
          <section className="panel">
            <h2>Plugin canvas</h2>
            <PluginGraph />
          </section>
          {activeChapter && (
            <section className="panel">
              <h2>What this chapter teaches</h2>
              <Theory chapter={activeChapter} />
            </section>
          )}
          {activeChapter && (
            <section className="panel">
              <h2>Source</h2>
              <SourceView chapter={activeChapter} />
            </section>
          )}
          <section className="panel">
            <h2>Live trace</h2>
            <EventLog />
          </section>
          <TerminalPanel />
        </main>
        <aside className="side-stack">
          <Workspace />
          <HistoryPanel />
        </aside>
      </div>
    </div>
  );
}
