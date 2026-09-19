import type { ChapterId } from "./index.js";

/**
 * Suggested prompts, per chapter - not one fixed script repeated across all
 * chapters. Each entry mirrors what that specific chapter actually teaches
 * (see web/src/components/Theory.tsx), so asking the agent to build
 * something here exercises the same concept the canvas/theory panel just
 * explained. `sequential` chips build on each other in order (same file,
 * each step extending the last); `standalone` is independent (or, for
 * Volume 2, the single next real file to build).
 *
 * This lives in `shared/`, not `web/`, for one reason beyond avoiding
 * duplication: it is the single source of truth for BOTH the UI's
 * suggestion chips AND `agent-trajectory-tests/`'s prompt chains - a golden
 * trajectory test replays the exact same prompts a user would click, not a
 * hand-copied approximation of them.
 */
export interface ChapterSuggestions {
  sequential?: string[];
  standalone?: string;
  hint?: string;
}

export const CHAPTER_SUGGESTIONS: Partial<Record<ChapterId, ChapterSuggestions>> = {
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
    standalone: "Mount it a third time, this time omitting the required field entirely - show me the real error",
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
    standalone: "Write a third version with a union-type config field (e.g. mode: 'fast' | 'accurate') with a default, mount it, and show me the resolved value",
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
    standalone: "Now write a SECOND Provider implementing the same service differently, mount it in place of the first, and confirm the Consumer keeps working unchanged",
    hint: "Steps 1-3 build the same three-role split this chapter's theory describes, one role at a time.",
  },
  "14-llm-adapters": {
    standalone: "Explain the StreamChunk protocol's block-start/block-end pairing rule for an LLM adapter",
  },
  "15-runtime-inspection-and-install": {
    standalone: "Explain the difference between dsh-tool-cordis's read-only inspection and the Plugin Manager's persistent installs",
  },
  // Volume 2 (16-24): every chip is a BUILD task - write a real file into
  // this workspace and mount it - not an "explain" or "inspect and report
  // back" prompt. This volume exists to rehearse an agent directing itself
  // to build its own Cordis plugins; a chip whose whole job is prose fails
  // that purpose no matter how well-written the prose is. By chapter 24 the
  // six files below are a real, complete, working coding agent, built by
  // the connected agent itself into workspace/ - not something pre-seeded.
  "16-what-is-an-agent": {
    standalone: "In one short paragraph, what's the difference between a plain chat UI and a coding agent? Nothing to build yet - chapter 17 starts the real build.",
  },
  "17-the-loop": {
    standalone:
      "Write agent-loop.mjs: a Cordis Service class providing 'agentLoop', static inject = ['tools', 'llm', 'systemPrompt']. Its runTurn(task) should push task as a user message, then loop up to ~10 steps: call this.ctx.llm.chat(messages, this.ctx.tools.definitions), append the reply, and if it returned tool calls, run each via this.ctx.tools.execute(name, input) and loop again - otherwise stop. Then mount_plugin it and tell me its real Fiber state.",
    hint: "Expect PENDING - none of tools/llm/systemPrompt exist as files yet. That's correct. You won't touch this file again; the next chapters add what it's missing.",
  },
  "18-tools": {
    standalone:
      "Write tools.mjs: a plugin providing 'tools' with `definitions` (an array of {name, description, input_schema}) and `execute(name, input)`. Give it 4 real tools operating on THIS directory - resolve it with path.dirname(fileURLToPath(import.meta.url)), the same real pattern run.mjs already uses, so paths work regardless of the server's own cwd: list_files, read_file, write_file, edit_file, using node:fs/promises. Then mount_plugin it.",
  },
  "19-context-window": {
    standalone:
      "Write context-window.mjs: a plugin providing 'contextWindow' with estimateTokens(messages) (rough char-count/4) and sharedPrefixLength(previous, current) (how many leading messages are byte-identical between two arrays). Mount it.",
  },
  "20-cache-and-compact": {
    standalone:
      "Write compaction.mjs: a plugin that provides 'compaction' (any marker value, so it has a real service identity) AND listens for the real Cordis event 'agent-harness/compact' (ctx.on, serial dispatch) - when the payload's estimatedTokens crosses ~6000, return a shortened messages array (keep the system message + newest 6, replace everything older with one summary message); otherwise return nothing. Mount it.",
  },
  "21-system-prompt": {
    standalone:
      "Write system-prompt.mjs: a plugin providing 'systemPrompt' with assemble() building a prompt string from this.ctx.tools.definitions and the real file listing in this directory. Mount it.",
  },
  "22-providers": {
    standalone:
      "Write llm.mjs: a plugin providing 'llm' with chat(messages, tools) that makes a real HTTP call to the configured provider via fetch, reading process.env.CORDIS_AGENT_PROVIDER/_MODEL/_API_KEY/_BASE_URL (already set for you - never ask the user for a key). Mount it, then tell me agentLoop's real Fiber state.",
    hint: "Every dependency should be satisfied now - this is the one where it should finally flip PENDING to ACTIVE.",
  },
  "23-the-harness": {
    standalone: "Use run_workspace_agent_turn to give the agent you just built a real task - for example, asking it to list and summarize this workspace.",
    hint: "This is the only chip in this tutorial that spends a real, billed LLM call just from being clicked - it drives a second, real turn through the agent you built, not this chat's own turn.",
  },
  "24-this-app": {
    standalone: "Read back each of the 6 files you wrote (agent-loop.mjs, tools.mjs, context-window.mjs, compaction.mjs, system-prompt.mjs, llm.mjs) and confirm the workspace really contains a complete, working agent.",
  },
};

export const DEFAULT_SUGGESTIONS: ChapterSuggestions = {
  sequential: [
    "Write a plugin that provides a greeter service, then mount it",
    "Write a second plugin that injects the greeter service and calls it",
    "Add a ctx.effect() heartbeat timer to the greeter plugin",
  ],
  standalone: "Read hello-plugin.mjs and extend it with a config schema",
  hint: "Steps 1-3 build on the same greeter plugin, in order. hello-plugin.mjs is independent.",
};

/** Flattens one chapter's suggestions into an ordered prompt chain: every
 * `sequential` step in order, then `standalone` last (matches the order a
 * user would naturally click them in the UI). Falls back to the default
 * greeter chain for a chapter with no entry (should not happen for any real
 * chapter id, but keeps this total like the UI's own fallback). */
export function promptChainFor(chapter: ChapterId): string[] {
  const s = CHAPTER_SUGGESTIONS[chapter] ?? DEFAULT_SUGGESTIONS;
  return [...(s.sequential ?? []), ...(s.standalone ? [s.standalone] : [])];
}
