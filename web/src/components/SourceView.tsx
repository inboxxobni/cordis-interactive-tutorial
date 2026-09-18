import { useEffect, useState } from "react";
import type { ChapterId } from "@cordis-tutorial/shared";
import { useStore } from "../store";
import { CodeEditor } from "./CodeEditor";

/**
 * Fetches and shows the REAL server-side source of the chapter that's
 * running right now - not a description of it, the actual file, via
 * GET /api/chapters/:id/source.
 */
export function SourceView({ chapter }: { chapter: ChapterId | null }) {
  const [state, setState] = useState<{ path: string; source: string } | { error: string } | null>(null);
  const sendMessage = useStore((s) => s.sendMessage);
  const configured = useStore((s) => s.configured);

  useEffect(() => {
    if (!chapter) {
      setState(null);
      return;
    }
    let cancelled = false;
    setState(null);
    fetch(`/api/chapters/${chapter}/source`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err) => {
        if (!cancelled) setState({ error: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  if (!chapter) return <p className="muted">Pick a chapter to see the real server-side code that runs it.</p>;
  if (!state) return <p className="muted">loading source…</p>;
  if ("error" in state) return <p className="muted">Couldn't load source: {state.error}</p>;

  return (
    <CodeEditor
      key={state.path}
      path={state.path}
      content={state.source}
      readOnly
      onExplainSelection={
        configured
          ? (selection, startLine, endLine) =>
              sendMessage(`Explain this part of ${state.path} (lines ${startLine}-${endLine}):\n\`\`\`\n${selection}\n\`\`\``)
          : undefined
      }
    />
  );
}
