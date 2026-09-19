import { useState } from "react";
import type { ChapterId } from "@cordis-tutorial/shared";
import { useStore } from "../store";

/**
 * Suggested prompts, per chapter - not one fixed script repeated across all
 * 15 chapters. Each entry mirrors what that specific chapter actually
 * teaches (see Theory.tsx), so asking the agent to build something here
 * exercises the same concept the canvas/theory panel just explained, not an
 * unrelated greeter plugin. `sequential` chips build on each other in order
 * (same file, each step extending the last); `standalone` is independent.
 * REF chapters (not runnable in this sandbox) get an explanatory prompt
 * instead of a write/mount one - there's no live Context action to ask for.
 */
interface ChapterSuggestions {
  sequential?: string[];
  standalone?: string;
  hint?: string;
  /** Chapter 23 only: the explicit, deliberate trigger for the real
   * from-scratch agent-loop's first turn (runInnerAgent, not sendMessage) -
   * the only chip in this whole tutorial that spends a real LLM call just
   * from being clicked, so it's kept structurally distinct from every
   * `standalone`/`sequential` entry above. */
  innerAgentTask?: string;
}

const CHAPTER_SUGGESTIONS: Partial<Record<ChapterId, ChapterSuggestions>> = {
  "01-first-plugin": {
    sequential: [
      "Write a plugin that logs a message on load, then mount it",
      "Rewrite it as an object-literal plugin instead of a function, then re-mount it",
    ],
    standalone: "Make a plugin throw inside apply() and mount it - show me it go FAILED, not silently skipped",
    hint: "Steps 1-2 build on the same file. The standalone prompt deliberately breaks a plugin to show a loud failure.",
  },
  "02-lifecycle-and-effects": {
    sequential: [
      "Write a plugin with a ctx.effect() heartbeat timer, then mount it",
      "Edit the interval and re-mount it - show me the old effect get cleaned up first",
      "Add a second ctx.effect() that logs on dispose, then unmount and check the order",
    ],
    hint: "Steps 1-3 build on the same plugin, in order.",
  },
  "03-services": {
    sequential: [
      "Write a plugin that provides a greeter service, then mount it",
      "Write a second plugin that injects the greeter service and calls it",
      "Add a ctx.effect() heartbeat timer to the greeter plugin",
    ],
    standalone: "Read hello-plugin.mjs and extend it with a config schema",
    hint: "Steps 1-3 build on the same greeter plugin, in order. hello-plugin.mjs is independent.",
  },
  "04-events": {
    sequential: [
      "Write a plugin with a counter service that ctx.emit()s an event on every change, then mount it",
      "Write a second plugin that ctx.on()s that event and logs it, then mount it",
      "Add a ctx.waterfall() step that transforms the emitted value before it's logged",
    ],
    hint: "Steps 1-3 build on the same counter/listener pair, in order.",
  },
  "05-configuration": {
    sequential: [
      "Write a plugin with a Schemastery Config schema (a greeting string with a default), then mount it",
      "Mount it again with deliberately invalid config - show me the real ValidationError",
    ],
    standalone: "Explain what happens if a required config field is missing when the plugin mounts",
  },
  "06-composition-and-hmr": {
    sequential: [
      "Write a plugin, mount it, then edit and re-mount it - confirm the old fiber disposed first",
    ],
    standalone: "Write a plugin that injects a service nobody provides, mount it, and explain why it stays PENDING",
  },
  "07-into-the-harness": {
    sequential: [
      "Write a plugin that registers a tool against an injected tools service, then mount it",
      "Write a second plugin that listens for tool results and logs them, then mount it",
    ],
    standalone: "Call the tool you just registered and show me the real result event firing",
  },
  "08-plugin-forms": {
    sequential: [
      "Write the same plugin as a function, then mount it",
      "Rewrite it as an object literal, then re-mount it",
      "Rewrite it as a class extending Service, then re-mount it",
    ],
    hint: "Steps 1-3 mount the identical behavior three different ways - watch the canvas, not the console.",
  },
  "09-build-a-tool": {
    sequential: [
      "Write a defineTool()-shaped tool plugin (name, parameters, output, execute), then mount it",
      "Call the tool you just registered and show me the real result",
      "Add a second required parameter to the tool and re-mount it",
    ],
  },
  "10-acryl-config": {
    sequential: [
      "Write a plugin with a Schemastery Config, then mount it with valid config",
      "Mount it again with invalid config - show me the real ValidationError",
    ],
    standalone: "Explain why this project uses Schemastery instead of the npm zod package",
  },
  "11-package-and-install": {
    standalone: "Explain the difference between a bundle manifest and a profile manifest, and which one this sandbox's mount_plugin skips entirely",
  },
  "12-built-in-services": {
    standalone: "List the real ACRYL services mounted on ctx in this workspace and where each is defined",
  },
  "13-three-role-capability": {
    sequential: [
      "Write a Service Definition plugin for a simple capability, then mount it",
      "Write a local Provider for it, then mount it",
      "Write a Consumer tool that injects and calls it, then mount it",
    ],
    standalone: "Explain why the Provider and Consumer shouldn't depend on each other directly",
    hint: "Steps 1-3 build the same three-role split this chapter's theory describes, one role at a time.",
  },
  "14-llm-adapters": {
    standalone: "Explain the StreamChunk protocol's block-start/block-end pairing rule for an LLM adapter",
  },
  "15-runtime-inspection-and-install": {
    standalone: "Explain the difference between dsh-tool-cordis's read-only inspection and the Plugin Manager's persistent installs",
  },
  "17-the-loop": {
    standalone: "Explain why agentLoop's fiber is PENDING right now, and what would make it ACTIVE",
  },
  "18-tools": {
    standalone: "List the 4 real tools just mounted and what each one does",
  },
  "19-context-window": {
    standalone: "Explain what sharedPrefixLength and estimateTokens actually measure",
  },
  "20-cache-and-compact": {
    standalone: "Explain when the compaction plugin actually replaces the message list, and by how much",
  },
  "21-system-prompt": {
    standalone: "Explain what's still missing before agentLoop can leave PENDING",
  },
  "22-providers": {
    standalone: "Explain what just made agentLoop's fiber flip from PENDING to ACTIVE",
  },
  "23-the-harness": {
    innerAgentTask: "List the files in this workspace, then summarize what this project is in one sentence.",
  },
  "24-this-app": {
    standalone: "Walk me through the real files under server/src/chapters/agent-harness/ this volume actually built",
  },
};

const DEFAULT_SUGGESTIONS: ChapterSuggestions = {
  sequential: [
    "Write a plugin that provides a greeter service, then mount it",
    "Write a second plugin that injects the greeter service and calls it",
    "Add a ctx.effect() heartbeat timer to the greeter plugin",
  ],
  standalone: "Read hello-plugin.mjs and extend it with a config schema",
  hint: "Steps 1-3 build on the same greeter plugin, in order. hello-plugin.mjs is independent.",
};

export function AgentConsole() {
  const configured = useStore((s) => s.configured);
  const agentRunning = useStore((s) => s.agentRunning);
  const agentStatus = useStore((s) => s.agentStatus);
  const chat = useStore((s) => s.chat);
  const sendMessage = useStore((s) => s.sendMessage);
  const runInnerAgent = useStore((s) => s.runInnerAgent);
  const activeChapter = useStore((s) => s.activeChapter);

  const [draft, setDraft] = useState("");

  const { sequential = [], standalone, hint, innerAgentTask } = (activeChapter && CHAPTER_SUGGESTIONS[activeChapter]) ?? DEFAULT_SUGGESTIONS;

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
          {innerAgentTask && (
            <button
              className="suggestion-inner-agent"
              disabled={!configured}
              title="Runs a real turn through the agent-loop this volume just built - a real, billed LLM call, unlike every other suggestion here."
              onClick={() => runInnerAgent(innerAgentTask)}
            >
              ▶ Ask the built agent: {innerAgentTask}
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
