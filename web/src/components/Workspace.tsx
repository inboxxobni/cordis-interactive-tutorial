import { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import { useStore } from "../store";
import { CodeEditor } from "./CodeEditor";

/**
 * The real workspace pane: file tree + diff view, ported from
 * aicodingagent-ts's Workspace.tsx (see docs/DEVELOPMENT-LOG.md in that repo
 * for why this shape - tabs, tree-building, unified diff - won over a flat
 * file list). No live-preview tab here: this sandbox writes Cordis plugin
 * files, not browser-renderable web apps, so that tab genuinely doesn't
 * apply - dropped, not faked.
 */
interface TreeNode {
  name: string;
  path: string;
  directory: boolean;
  children: TreeNode[];
}

export function Workspace() {
  const workspacePath = useStore((s) => s.workspacePath);
  const files = useStore((s) => s.workspaceFiles);
  const openFile = useStore((s) => s.openFile);
  const fileContents = useStore((s) => s.fileContents);
  const baselineContents = useStore((s) => s.baselineContents);
  const setOpenFile = useStore((s) => s.setOpenFile);
  const saveFile = useStore((s) => s.saveFile);
  const sendMessage = useStore((s) => s.sendMessage);
  const configured = useStore((s) => s.configured);
  const [tab, setTab] = useState<"files" | "diff">("files");
  // Separate from `openFile` (the store's notion of "selected" file, used for
  // diff-tab selection and defaulted on every session_start) - the editor
  // overlay only opens on an explicit click, never automatically on connect.
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const viewingContent = viewingFile ? fileContents[viewingFile] ?? "" : "";
  const tree = useMemo(() => buildTree(files), [files]);
  const changedFiles = useMemo(() => changedFilePaths(files, baselineContents, fileContents), [files, baselineContents, fileContents]);

  const openInEditor = (path: string) => {
    setOpenFile(path);
    setViewingFile(path);
  };

  return (
    <div className="side-panel">
      <div className="panel-head workspace-head">
        <span className="panel-title">
          <span className="dot" /> workspace
        </span>
        <span className="panel-meta" title={workspacePath || "workspace path unavailable"}>
          {workspacePath ? shortenPath(workspacePath) : "connecting…"}
        </span>
      </div>

      <div className="ws-tabs">
        <button className={`ws-tab${tab === "files" ? " active" : ""}`} onClick={() => setTab("files")}>
          files · {files.filter((f) => !f.endsWith("/")).length}
        </button>
        <button className={`ws-tab${tab === "diff" ? " active" : ""}`} onClick={() => setTab("diff")}>
          diff · {changedFiles.length}
        </button>
      </div>

      {tab === "files" && (
        <div className="ws-body ws-body-tree-only">
          <div className="ws-tree ws-tree-full">
            {tree.length === 0 && <span className="hint">empty</span>}
            {tree.map((node) => (
              <TreeItem key={node.path} node={node} openFile={openFile} onOpen={openInEditor} />
            ))}
          </div>
        </div>
      )}

      {/* A code editor needs real width and height to be usable - it does not
          fit in this 340px sidebar column, so opening a file pops a large
          overlay instead of squeezing Monaco in here (same overlay pattern
          as Settings). */}
      {viewingFile && (
        <div className="file-editor-overlay" onClick={() => setViewingFile(null)}>
          <div className="file-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="file-editor-header">
              <button className="btn ghost" onClick={() => setViewingFile(null)}>
                close
              </button>
            </div>
            <CodeEditor
              key={viewingFile}
              path={viewingFile}
              content={viewingContent}
              height="72vh"
              onSave={(next) => saveFile(viewingFile, next)}
              onExplainSelection={
                configured
                  ? (selection, startLine, endLine) =>
                      sendMessage(
                        `Explain this part of ${viewingFile} (lines ${startLine}-${endLine}):\n\`\`\`\n${selection}\n\`\`\``,
                      )
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {tab === "diff" && (
        <div className="diff-body">
          <div className="diff-files">
            {changedFiles.length === 0 && <div className="ws-empty">No changes yet. Run a chapter or the agent to create or edit files.</div>}
            {changedFiles.map((path) => (
              <button key={path} className={`diff-file${openFile === path ? " active" : ""}`} onClick={() => setOpenFile(path)}>
                <span className={baselineContents[path] === undefined ? "diff-added" : files.includes(path) ? "diff-changed" : "diff-removed"}>
                  {baselineContents[path] === undefined ? "+" : files.includes(path) ? "~" : "−"}
                </span>
                {path}
              </button>
            ))}
          </div>
          <pre className="ws-viewer diff-viewer">
            {openFile && changedFiles.includes(openFile)
              ? renderDiff(baselineContents[openFile] ?? "", fileContents[openFile] ?? "", baselineContents[openFile] === undefined ? "new file" : "")
              : "Select a changed file to inspect its diff."}
          </pre>
        </div>
      )}
    </div>
  );
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const raw of paths.filter((p) => p.length > 0)) {
    const isDirectory = raw.endsWith("/");
    const parts = raw.replace(/\/$/, "").split("/");
    let level = root;
    let parentPath = "";
    parts.forEach((name, index) => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      let node = level.find((item) => item.name === name);
      if (!node) {
        node = { name, path, directory: index < parts.length - 1 || isDirectory, children: [] };
        level.push(node);
      }
      parentPath = path;
      level = node.children;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root);
  return root;
}

function TreeItem({ node, openFile, onOpen, depth = 0 }: { node: TreeNode; openFile: string | null; onOpen: (path: string) => void; depth?: number }) {
  return (
    <>
      <div
        className={`file${openFile === node.path ? " active" : ""}`}
        style={{ paddingLeft: `${4 + depth * 12}px` }}
        onClick={() => !node.directory && onOpen(node.path)}
      >
        {node.directory ? "▾ " : "📄 "}
        {node.name}
        {node.directory ? "/" : ""}
      </div>
      {node.children.map((child) => (
        <TreeItem key={child.path} node={child} openFile={openFile} onOpen={onOpen} depth={depth + 1} />
      ))}
    </>
  );
}

function changedFilePaths(files: string[], baseline: Record<string, string> = {}, current: Record<string, string> = {}): string[] {
  const paths = new Set([...Object.keys(baseline), ...files.filter((f) => !f.endsWith("/")), ...Object.keys(current)]);
  return [...paths]
    .filter((path) => {
      const before = baseline[path];
      const after = current[path];
      return before === undefined || after === undefined || before !== after;
    })
    .sort();
}

function renderDiff(before: string, after: string, note: string): string {
  const lines = diffLines(before, after);
  const output = lines
    .map((part: Change) => {
      const prefix = part.added ? "+ " : part.removed ? "− " : "  ";
      return part.value
        .split("\n")
        .map((line: string, index: number, all: string[]) => (index === all.length - 1 && line === "" ? "" : prefix + line))
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");
  return note ? `+ ${note}\n\n${output}` : output || "No textual changes.";
}

function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, "~");
}
