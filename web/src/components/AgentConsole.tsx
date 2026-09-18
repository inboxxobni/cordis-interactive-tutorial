import { useState } from "react";
import { useStore } from "../store";

// The first three build on each other in order (same greeter plugin file,
// each step extending the last) - numbered so that's explicit, not assumed.
// The fourth is independent: hello-plugin.mjs is seeded into every fresh
// workspace (see Workspace.seed()), so it's available from the start.
const SEQUENTIAL_SUGGESTIONS = [
  "Write a plugin that provides a greeter service, then mount it",
  "Write a second plugin that injects the greeter service and calls it",
  "Add a ctx.effect() heartbeat timer to the greeter plugin",
];
const STANDALONE_SUGGESTION = "Read hello-plugin.mjs and extend it with a config schema";

export function AgentConsole() {
  const configured = useStore((s) => s.configured);
  const agentRunning = useStore((s) => s.agentRunning);
  const agentStatus = useStore((s) => s.agentStatus);
  const chat = useStore((s) => s.chat);
  const sendMessage = useStore((s) => s.sendMessage);

  const [draft, setDraft] = useState("");

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
        {chat.length === 0 && <p className="muted">Ask the agent to build, extend, or debug a Cordis plugin - try one of these:</p>}
        <div className="suggestion-chips">
          {SEQUENTIAL_SUGGESTIONS.map((s, i) => (
            <button key={s} disabled={!configured || agentRunning} onClick={() => submit(s)}>
              <span className="suggestion-step">{i + 1}.</span> {s}
            </button>
          ))}
          <button disabled={!configured || agentRunning} onClick={() => submit(STANDALONE_SUGGESTION)}>
            {STANDALONE_SUGGESTION}
          </button>
        </div>
        {chat.length > 0 && <p className="muted suggestion-hint">Steps 1-3 build on the same greeter plugin, in order. hello-plugin.mjs is independent.</p>}
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
