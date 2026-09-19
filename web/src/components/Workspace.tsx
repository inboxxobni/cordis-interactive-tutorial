import { useMemo } from "react";
import { diffLines, type Change } from "diff";

/**
 * The real workspace's file-tree and diff building blocks - ported from
 * aicodingagent-ts's Workspace.tsx and now used directly inside the
 * workbench's `editor`/`diff` tabs (see Workbench.tsx) instead of behind a
 * squeezed 340px sidebar + popup overlay. The tree/diff logic itself never
 * changed; only where it renders did.
 */
interface TreeNode {
  name: string;
  path: string;
  directory: boolean;
  children: TreeNode[];
}

export function FileTree({ files, openFile, onOpen }: { files: string[]; openFile: string | null; onOpen: (path: string) => void }) {
  const tree = useMemo(() => buildTree(files), [files]);
  return (
    <div className="ws-tree">
      {tree.length === 0 && <span className="hint">empty</span>}
      {tree.map((node) => (
        <TreeItem key={node.path} node={node} openFile={openFile} onOpen={onOpen} />
      ))}
    </div>
  );
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

export function DiffFileList({
  changed,
  files,
  baselineContents,
  openFile,
  onSelect,
}: {
  changed: string[];
  files: string[];
  baselineContents: Record<string, string>;
  openFile: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="diff-files">
      {changed.length === 0 && <div className="ws-empty">No changes yet. Run a chapter or the agent to create or edit files.</div>}
      {changed.map((path) => (
        <button key={path} className={`diff-file${openFile === path ? " active" : ""}`} onClick={() => onSelect(path)}>
          <span className={baselineContents[path] === undefined ? "diff-added" : files.includes(path) ? "diff-changed" : "diff-removed"}>
            {baselineContents[path] === undefined ? "+" : files.includes(path) ? "~" : "−"}
          </span>
          {path}
        </button>
      ))}
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

export function changedFilePaths(files: string[], baseline: Record<string, string> = {}, current: Record<string, string> = {}): string[] {
  const paths = new Set([...Object.keys(baseline), ...files.filter((f) => !f.endsWith("/")), ...Object.keys(current)]);
  return [...paths]
    .filter((path) => {
      const before = baseline[path];
      const after = current[path];
      return before === undefined || after === undefined || before !== after;
    })
    .sort();
}

export function renderDiff(before: string, after: string, note: string): string {
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

export function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, "~");
}
