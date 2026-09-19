import { useMemo, useState } from "react";
import { Code2, FileCode2, GitCompareArrows, Network, TerminalSquare, BookOpen, CircleStop } from "lucide-react";
import { useStore } from "../store";
import { PluginGraph } from "./PluginGraph";
import { Theory } from "./Theory";
import { SourceView } from "./SourceView";
import { CodeEditor } from "./CodeEditor";
import { TerminalPanel } from "./Terminal";
import { EventLog } from "./EventLog";
import { DiffFileList, FileTree, changedFilePaths, renderDiff } from "./Workspace";

type WorkbenchTab = "canvas" | "theory" | "source" | "editor" | "diff" | "terminal";

const TABS: { id: WorkbenchTab; label: string; icon: typeof Network }[] = [
  { id: "canvas", label: "canvas", icon: Network },
  { id: "theory", label: "theory", icon: BookOpen },
  { id: "source", label: "source", icon: Code2 },
  { id: "editor", label: "editor", icon: FileCode2 },
  { id: "diff", label: "diff", icon: GitCompareArrows },
  { id: "terminal", label: "terminal", icon: TerminalSquare },
];

/**
 * The center column: state bar, first-class tabs for every code-shaped
 * surface (canvas/theory/source/editor/diff/terminal - no more popping a
 * file editor open as a modal overlay), and the live trace dock underneath.
 * Every tab body stays mounted (toggled with the `hidden` attribute, never
 * unmounted) so the Monaco editor's unsaved draft and the terminal's real
 * xterm.js scrollback both survive switching tabs - the same class of bug
 * this project already hit twice with careless remounts.
 */
export function Workbench() {
  const [tab, setTab] = useState<WorkbenchTab>("canvas");

  const connected = useStore((s) => s.connected);
  const activeChapter = useStore((s) => s.activeChapter);
  const chapterTitle = useStore((s) => s.chapterTitle);
  const chapterRunning = useStore((s) => s.chapterRunning);
  const agentRunning = useStore((s) => s.agentRunning);
  const replaying = useStore((s) => s.replaying);
  const stopChapter = useStore((s) => s.stopChapter);
  const openFile = useStore((s) => s.openFile);
  const setOpenFile = useStore((s) => s.setOpenFile);
  const workspaceFiles = useStore((s) => s.workspaceFiles);
  const fileContents = useStore((s) => s.fileContents);
  const baselineContents = useStore((s) => s.baselineContents);
  const saveFile = useStore((s) => s.saveFile);
  const sendMessage = useStore((s) => s.sendMessage);
  const configured = useStore((s) => s.configured);

  const changedFiles = useMemo(
    () => changedFilePaths(workspaceFiles, baselineContents, fileContents),
    [workspaceFiles, baselineContents, fileContents],
  );

  const state = replaying
    ? { label: "REPLAY", detail: "Live input paused - step through the timeline in Sessions" }
    : agentRunning
      ? { label: "AGENT EDITING", detail: "The build agent is writing and mounting a plugin" }
      : chapterRunning
        ? { label: "CHAPTER RUNNING", detail: chapterTitle ?? activeChapter ?? "" }
        : connected
          ? { label: "CONTEXT READY", detail: "Waiting for a chapter or workspace action" }
          : { label: "OFFLINE", detail: "Connecting to the tutorial server…" };

  return (
    <main className="workbench">
      <div className="state-bar">
        <div className="state-bar-info">
          <span className={`state-orb${connected ? "" : " offline"}`} />
          <div>
            <strong>{state.label}</strong>
            <small>{state.detail}</small>
          </div>
        </div>
        {chapterRunning && (
          <button className="btn ghost danger" onClick={stopChapter}>
            <CircleStop size={13} /> stop
          </button>
        )}
      </div>

      <div className="workbench-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? "tab-active" : ""} onClick={() => setTab(id)}>
            <Icon /> {label}
          </button>
        ))}
      </div>

      <div className="workbench-content">
        <div className="workbench-pane" hidden={tab !== "canvas"}>
          <PluginGraph />
        </div>

        <div className="workbench-pane" hidden={tab !== "theory"}>
          <div className="workbench-surface">
            <Theory chapter={activeChapter} />
          </div>
        </div>

        <div className="workbench-pane" hidden={tab !== "source"}>
          <div className="workbench-surface no-pad">
            <SourceView chapter={activeChapter} />
          </div>
        </div>

        <div className="workbench-pane" hidden={tab !== "editor"}>
          <div className="workbench-split">
            <FileTree
              files={workspaceFiles}
              openFile={openFile}
              onOpen={(path) => {
                setOpenFile(path);
                setTab("editor");
              }}
            />
            <div className="workbench-surface">
              {openFile ? (
                <CodeEditor
                  key={openFile}
                  path={openFile}
                  content={fileContents[openFile] ?? ""}
                  height="100%"
                  onSave={(next) => saveFile(openFile, next)}
                  onExplainSelection={
                    configured
                      ? (selection, startLine, endLine) =>
                          sendMessage(`Explain this part of ${openFile} (lines ${startLine}-${endLine}):\n\`\`\`\n${selection}\n\`\`\``)
                      : undefined
                  }
                />
              ) : (
                <div className="canvas-empty">Select a file from the tree to view or edit it.</div>
              )}
            </div>
          </div>
        </div>

        <div className="workbench-pane" hidden={tab !== "diff"}>
          <div className="workbench-split">
            <DiffFileList changed={changedFiles} files={workspaceFiles} baselineContents={baselineContents} openFile={openFile} onSelect={setOpenFile} />
            <div className="workbench-surface no-pad">
              <pre className="diff-viewer">
                {openFile && changedFiles.includes(openFile)
                  ? renderDiff(baselineContents[openFile] ?? "", fileContents[openFile] ?? "", baselineContents[openFile] === undefined ? "new file" : "")
                  : "Select a changed file to inspect its diff."}
              </pre>
            </div>
          </div>
        </div>

        <div className="workbench-pane" hidden={tab !== "terminal"}>
          <TerminalPanel visible={tab === "terminal"} />
        </div>
      </div>

      <div className="bottom-dock">
        <div className="dock-heading">
          <span className="label">
            <TerminalSquare size={13} /> LIVE TRACE
          </span>
        </div>
        <EventLog variant="dock" />
      </div>
    </main>
  );
}
