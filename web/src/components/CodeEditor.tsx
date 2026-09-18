import { useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNS } from "monaco-editor";

/**
 * Real syntax highlighting + editing for the workspace's files and the
 * chapters' own source, via Monaco (the same editor VS Code uses) - not a
 * <pre> block. Two capabilities beyond viewing:
 *  - onSave: persist an edit back to the real file on disk (see store.ts's
 *    saveFile() -> the 'save_file' WS message -> Workspace.writeFile()).
 *  - onExplainSelection: highlight any span and ask the agent what it does,
 *    via Monaco's own selection API - not a guess at what "selection" means.
 */
interface Props {
  path: string;
  content: string;
  readOnly?: boolean;
  height?: string;
  onSave?: (content: string) => void;
  onExplainSelection?: (selection: string, startLine: number, endLine: number) => void;
}

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return "plaintext";
  }
}

export function CodeEditor({ path, content, readOnly = false, height = "360px", onSave, onExplainSelection }: Props) {
  const [draft, setDraft] = useState(content);
  const [hasSelection, setHasSelection] = useState(false);
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);

  const dirty = !readOnly && draft !== content;

  const handleMount: OnMount = (editorInstance, _monaco: Monaco) => {
    editorRef.current = editorInstance;
    editorInstance.onDidChangeCursorSelection((e) => {
      setHasSelection(!e.selection.isEmpty());
    });
  };

  const explainSelection = () => {
    const ed = editorRef.current;
    if (!ed || !onExplainSelection) return;
    const selection = ed.getSelection();
    const model = ed.getModel();
    if (!selection || !model || selection.isEmpty()) return;
    const text = model.getValueInRange(selection);
    onExplainSelection(text, selection.startLineNumber, selection.endLineNumber);
  };

  return (
    <div className="code-editor">
      <div className="code-editor-toolbar">
        <span className="code-editor-path">{path}</span>
        {hasSelection && onExplainSelection && (
          <button className="btn ghost" onClick={explainSelection}>
            ? explain selection
          </button>
        )}
        {dirty && onSave && (
          <>
            <span className="code-editor-dirty">unsaved</span>
            <button className="btn primary" onClick={() => onSave(draft)}>
              save
            </button>
            <button className="btn ghost" onClick={() => setDraft(content)}>
              revert
            </button>
          </>
        )}
      </div>
      <Editor
        height={height}
        theme="vs-dark"
        path={path}
        language={languageFor(path)}
        value={draft}
        onMount={handleMount}
        onChange={(value) => setDraft(value ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: "JetBrains Mono, SF Mono, Fira Code, Menlo, Consolas, monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
