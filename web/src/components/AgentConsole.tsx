import { useState } from "react";
import { CHAPTER_SUGGESTIONS, DEFAULT_SUGGESTIONS } from "@cordis-tutorial/shared/chapter-suggestions";
import { useStore } from "../store";

/**
 * Suggestion-chip content lives in shared/chapter-suggestions.ts, not here -
 * it's the single source of truth for both this UI and
 * agent-trajectory-tests/'s prompt chains, so a golden-trajectory test
 * replays the exact same prompts a user would click, never a hand-copied
 * approximation of them.
 */
export function AgentConsole() {
  const configured = useStore((s) => s.configured);
  const agentRunning = useStore((s) => s.agentRunning);
  const agentStatus = useStore((s) => s.agentStatus);
  const chat = useStore((s) => s.chat);
  const sendMessage = useStore((s) => s.sendMessage);
  const activeChapter = useStore((s) => s.activeChapter);

  const [draft, setDraft] = useState("");

  const { sequential = [], standalone, hint } = (activeChapter && CHAPTER_SUGGESTIONS[activeChapter]) ?? DEFAULT_SUGGESTIONS;

  const submit = (text?: string) => {
    const value = (text ?? draft).trim();
    if (!value || agentRunning || !configured) return;
    sendMessage(value);
    setDraft("");
  };

  return (
    <div className="agent-console">
      <div className="agent-console-status">{configured ? `● ${agentStatus}` : "○ connect a DeepSeek key above to start"}</div>

      <div className="agent-chat">
        {chat.length === 0 && (
          <p className="muted">
            {activeChapter ? "Try one of these, matching what this chapter teaches:" : "Pick a chapter, or ask the agent to build, extend, or debug a Cordis plugin - try one of these:"}
          </p>
        )}
        <div className="suggestion-chips">
          {sequential.map((s, i) => (
            <button key={s} disabled={!configured || agentRunning} onClick={() => submit(s)}>
              <span className="suggestion-step">{i + 1}.</span> {s}
            </button>
          ))}
          {standalone && (
            <button disabled={!configured || agentRunning} onClick={() => submit(standalone)}>
              {standalone}
            </button>
          )}
        </div>
        {chat.length > 0 && hint && <p className="muted suggestion-hint">{hint}</p>}
        {chat.map((line) => (
          <div key={line.id} className={`chat-line role-${line.role}`}>
            {line.text}
          </div>
        ))}
      </div>

      <div className="agent-input">
        <textarea
          placeholder="ask the agent to build, extend, or fix a Cordis plugin"
          value={draft}
          disabled={!configured || agentRunning}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button disabled={!configured || agentRunning || !draft.trim()} onClick={() => submit()}>
          {agentRunning ? "working…" : "send"}
        </button>
      </div>
    </div>
  );
}
