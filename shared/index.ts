/**
 * @cordis-tutorial/shared
 *
 * The single contract shared between the tutorial server (a real,
 * instrumented @deepseek-ai/cordis Context) and the visualizer (web).
 * Everything that crosses the WebSocket is typed here so the two sides can
 * never drift silently.
 *
 * Mental model:
 *   Cordis = a small runtime where every capability - tools, services,
 *   the event bus itself - is a plugin mounted into a shared Context.
 *
 * The server runs real chapters against a real Context and emits
 * CordisTraceEvents for every lifecycle step; the browser renders them.
 */

// ---------------------------------------------------------------------------
// Chapters, grouped into Parts. Parts 1 follows the official Cordis tutorial
// curriculum 1:1; Parts 2-4 follow DeepSeek Harness's own docs
// (develop/basic, develop/framework, develop/practice), grounded wherever
// possible in ACRYL's own real code, not generic examples.
// ---------------------------------------------------------------------------

export type ChapterId =
  | "01-first-plugin"
  | "02-lifecycle-and-effects"
  | "03-services"
  | "04-events"
  | "05-configuration"
  | "06-composition-and-hmr"
  | "07-into-the-harness"
  | "08-plugin-forms"
  | "09-build-a-tool"
  | "10-acryl-config"
  | "11-package-and-install"
  | "12-built-in-services"
  | "13-three-role-capability"
  | "14-llm-adapters"
  | "15-runtime-inspection-and-install";

export type ChapterPart = "cordis-core" | "acryl-harness-basics" | "acryl-services" | "practice";

export const PARTS: { id: ChapterPart; title: string }[] = [
  { id: "cordis-core", title: "Part 1 - Cordis core" },
  { id: "acryl-harness-basics", title: "Part 2 - ACRYL Harness basics" },
  { id: "acryl-services", title: "Part 3 - ACRYL's built-in services" },
  { id: "practice", title: "Part 4 - Practice" },
];

export interface ChapterInfo {
  id: ChapterId;
  part: ChapterPart;
  index: number;
  title: string;
  summary: string;
  /** false = structurally scaffolded but not yet a real running chapter. */
  implemented: boolean;
  /**
   * false = reference-only: real, grounded explanation and code, but not
   * something this sandbox can actually run (package installation, a full
   * LLM adapter, etc. need real DSH plumbing this teaching sandbox
   * deliberately doesn't pull in). true chapters have a working "run" button.
   */
  runnable: boolean;
}

export const CHAPTERS: ChapterInfo[] = [
  {
    id: "01-first-plugin",
    part: "cordis-core",
    index: 1,
    title: "Your first plugin",
    summary: "A plugin is a function loaded by the framework: export apply(ctx).",
    implemented: true,
    runnable: true,
  },
  {
    id: "02-lifecycle-and-effects",
    part: "cordis-core",
    index: 2,
    title: "Lifecycle and effects",
    summary: "Fiber states (PENDING -> LOADING -> ACTIVE -> ... -> DISPOSED) and ctx.effect() cleanup.",
    implemented: true,
    runnable: true,
  },
  {
    id: "03-services",
    part: "cordis-core",
    index: 3,
    title: "Services",
    summary: "Exposing a capability on ctx, and requiring one with inject.",
    implemented: true,
    runnable: true,
  },
  {
    id: "04-events",
    part: "cordis-core",
    index: 4,
    title: "Events",
    summary: "Typed events, broadcasting, and conditional (waterfall) dispatch.",
    implemented: true,
    runnable: true,
  },
  {
    id: "05-configuration",
    part: "cordis-core",
    index: 5,
    title: "Configuration",
    summary: "A Standard Schema config validator, and the real ValidationError when it's wrong.",
    implemented: true,
    runnable: true,
  },
  {
    id: "06-composition-and-hmr",
    part: "cordis-core",
    index: 6,
    title: "Composition and HMR",
    summary: "fiber.update() - real hot-reload: same fiber identity, re-run apply().",
    implemented: true,
    runnable: true,
  },
  {
    id: "07-into-the-harness",
    part: "cordis-core",
    index: 7,
    title: "Into the harness",
    summary: "A minimal ctx.tools seam and a plugin registering a callable tool against it.",
    implemented: true,
    runnable: true,
  },
  {
    id: "08-plugin-forms",
    part: "acryl-harness-basics",
    index: 8,
    title: "Your first ACRYL Harness plugin",
    summary: "The same plugin written three ways - function, object, and class - all equally real.",
    implemented: true,
    runnable: true,
  },
  {
    id: "09-build-a-tool",
    part: "acryl-harness-basics",
    index: 9,
    title: "Build a tool",
    summary: "defineTool() against an injected tools service - the real shape ACRYL's own tools use.",
    implemented: true,
    runnable: true,
  },
  {
    id: "10-acryl-config",
    part: "acryl-harness-basics",
    index: 10,
    title: "Plugin configuration, the ACRYL way",
    summary: "Schemastery, not zod - ACRYL's real Config convention, validated the same way Cordis requires.",
    implemented: true,
    runnable: true,
  },
  {
    id: "11-package-and-install",
    part: "acryl-harness-basics",
    index: 11,
    title: "Package and install a plugin",
    summary: "Bundle vs. profile manifests, install order, and the GitHub build-script catch. Reference only - needs real DSH plumbing this sandbox doesn't pull in.",
    implemented: true,
    runnable: false,
  },
  {
    id: "12-built-in-services",
    part: "acryl-services",
    index: 12,
    title: "ACRYL's built-in services",
    summary: "Real named services present on every ACRYL instance, even a blank one - with file:line citations, not a static list.",
    implemented: true,
    runnable: false,
  },
  {
    id: "13-three-role-capability",
    part: "practice",
    index: 13,
    title: "Three-role capability design",
    summary: "Service Definition / Provider / Consumer, built live - mirroring ACRYL's real acrAgentControl split.",
    implemented: true,
    runnable: true,
  },
  {
    id: "14-llm-adapters",
    part: "practice",
    index: 14,
    title: "LLM adapters",
    summary: "The stream()/StreamChunk contract a new LLM provider implements. Reference only.",
    implemented: true,
    runnable: false,
  },
  {
    id: "15-runtime-inspection-and-install",
    part: "practice",
    index: 15,
    title: "Runtime inspection & Plugin Manager",
    summary: "What dsh-tool-cordis (read-only) and Plugin Manager (persistent) actually do - and why neither is this tutorial's mount_plugin. Reference only.",
    implemented: true,
    runnable: false,
  },
];

// ---------------------------------------------------------------------------
// Fiber / lifecycle vocabulary
// ---------------------------------------------------------------------------

export type FiberState = "PENDING" | "LOADING" | "ACTIVE" | "FAILED" | "UNLOADING" | "DISPOSED";

// ---------------------------------------------------------------------------
// Agent loop: LLM message format (canonical: Anthropic-style content blocks)
// ---------------------------------------------------------------------------

export type Role = "system" | "user" | "assistant" | "tool";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: Role;
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: string;
  usage: LLMUsage;
  raw?: unknown;
}

export type ProviderId = "deepseek" | "openai" | "anthropic" | "byteplus" | "qwen" | "ollama" | "lmstudio";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Short help shown in the key field placeholder. */
  keyHint: string;
  docsUrl: string;
  /** Curated model ids the UI offers as defaults. Free text is allowed too. */
  models: string[];
  /** Default base URL used when the user does not override it. */
  baseURL: string;
}

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseURL?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    keyHint: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp", "deepseek-flash"],
    baseURL: "https://api.deepseek.com/v1",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    baseURL: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    keyHint: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
    baseURL: "https://api.anthropic.com/v1",
  },
  {
    id: "byteplus",
    label: "Byteplus (Coding)",
    keyHint: "VOLCENGINE_ARK_API_KEY",
    docsUrl: "https://console.byteplus.com/en/ark/region:ap-southeast-1/endpoint",
    models: [
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "ark-code-latest",
      "dola-seed-2.0-pro",
      "dola-seed-2.0-lite",
      "kimi-k2.5",
      "glm-5.1",
      "glm-5.2",
      "gpt-oss-120b",
    ],
    baseURL: "https://ark.ap-southeast.bytepluses.com/api/coding/v1",
  },
  {
    id: "qwen",
    label: "Qwen (Token Plan)",
    keyHint: "sk-sp-... from Qwen Token Plan",
    docsUrl: "https://modelstudio.console.alibabacloud.com/",
    models: [
      "qwen3.8-max",
      "qwen3.8-flash",
      "qwen3.7-max",
      "qwen3.7-plus",
      "qwen3.6-flash",
      "deepseek-v4.1-flash",
      "deepseek-v4-pro",
      "glm-5.2",
    ],
    baseURL: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
  },
  {
    id: "ollama",
    label: "OLLAMA",
    keyHint: "(no key needed)",
    docsUrl: "https://ollama.com/",
    models: ["llama3.2", "qwen2.5", "mistral", "codellama", "deepseek-coder", "phi-4"],
    baseURL: "http://localhost:11434/v1",
  },
  {
    id: "lmstudio",
    label: "LMStudio",
    keyHint: "(no key needed)",
    docsUrl: "https://lmstudio.ai/",
    models: ["local-model"],
    baseURL: "http://localhost:1234/v1",
  },
];

/** Local runtimes (OLLAMA, LMStudio) serve models without authentication. */
export function providerRequiresApiKey(provider: ProviderId): boolean {
  return provider !== "ollama" && provider !== "lmstudio";
}

export const DEFAULT_MAX_STEPS = 25;
export const DEFAULT_SPEED_MS = 150;

// ---------------------------------------------------------------------------
// Trace events: server -> browser (over the WebSocket)
// ---------------------------------------------------------------------------

export type AgentStatus =
  | "idle"
  | "running"
  | "calling-llm"
  | "executing-tools"
  | "done"
  | "error";

export type FileAction = "create" | "edit";

export type TraceEvent =
  // -- Cordis lifecycle: real internal events off the instrumented Context --
  | { type: "session_start"; sessionId: string; chapters: ChapterInfo[]; workspaceFiles: string[]; workspacePath: string; workspaceSnapshot: Record<string, string> }
  | { type: "chapter_change"; chapter: ChapterId }
  | { type: "chapter_start"; chapter: ChapterId; title: string }
  | { type: "chapter_end"; chapter: ChapterId }
  | {
      type: "plugin_register";
      pluginId: string;
      name: string;
      hasInject: boolean;
      inject: string[];
      /** Present when this plugin came from a real workspace file (agent-built), not a fixed chapter. */
      sourcePath?: string;
    }
  | { type: "fiber_state_change"; pluginId: string; from: FiberState | null; to: FiberState; reason?: string }
  | { type: "service_provide"; pluginId: string; serviceName: string }
  | { type: "service_inject"; pluginId: string; serviceName: string; satisfied: boolean }
  | { type: "effect_acquire"; pluginId: string; label: string }
  | { type: "effect_dispose"; pluginId: string; label: string }
  | { type: "event_listen"; pluginId: string; eventName: string }
  | { type: "event_emit"; eventName: string; payload: unknown; listenerCount: number }
  | { type: "config_validate"; pluginId: string; config: unknown; valid: boolean }
  | { type: "config_error"; pluginId: string; message: string }
  | { type: "patch_applied"; description: string }
  | { type: "hmr_reload"; pluginId: string }
  | { type: "plugin_unmount"; pluginId: string }
  | { type: "log"; pluginId: string | null; message: string }
  // -- Agent loop: same shapes as Agent Loop (aicodingagent-ts), ported --
  | { type: "turn_start"; turn: number; userMessage: string }
  | { type: "loop_start"; iteration: number; maxSteps: number; contextTokens: number; messageCount: number }
  | {
      type: "llm_request";
      provider: string;
      model: string;
      url: string;
      messageCount: number;
      tools: string[];
      payload: unknown;
      cacheableMessageCount: number;
    }
  | { type: "llm_delta"; text: string }
  | { type: "llm_response"; text: string; toolCalls: ToolCall[]; stopReason: string; usage: LLMUsage; raw?: unknown }
  | { type: "assistant_message"; text: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_result"; toolCallId: string; name: string; input: Record<string, unknown>; result: string; isError: boolean; durationMs: number }
  | { type: "file_changed"; path: string; action: FileAction; content: string }
  | { type: "workspace_files"; files: string[] }
  | { type: "workspace_reset"; files: string[]; snapshot: Record<string, string> }
  | { type: "loop_end"; iteration: number; stopReason: string; usage: LLMUsage; totalTokens: number }
  | { type: "turn_end"; turn: number; stopReason: string; totalTokens: number; steps: number }
  | { type: "max_steps_reached"; maxSteps: number }
  | { type: "status"; status: AgentStatus; message?: string }
  | { type: "connection_test_result"; ok: boolean; message: string }
  | { type: "archive_list"; archives: ArchiveMeta[] }
  | { type: "archive_saved"; archive: ArchiveMeta }
  | { type: "archive_loaded"; archive: ArchiveMeta; files: string[]; snapshot: Record<string, string>; history: RecordedSession }
  | { type: "terminal_started"; shell: string }
  | { type: "terminal_output"; data: string }
  | { type: "terminal_exit"; exitCode: number }
  | { type: "error"; message: string; fatal: boolean };

// ---------------------------------------------------------------------------
// Client messages: browser -> server (over the WebSocket)
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: "connect" }
  | { type: "run_chapter"; chapter: ChapterId }
  | { type: "stop" }
  | { type: "configure"; provider: ProviderId; model: string; apiKey: string; baseURL?: string }
  | { type: "test_connection"; provider: ProviderId; model: string; apiKey: string; baseURL?: string }
  | { type: "run"; message: string }
  | { type: "reset_workspace" }
  | { type: "save_file"; path: string; content: string }
  | { type: "archive_current"; title: string; history: RecordedSession }
  | { type: "list_archives" }
  | { type: "load_archive"; id: string; currentHistory: RecordedSession | null }
  | { type: "restore_bundle"; files: Record<string, string> }
  | { type: "terminal_start"; cols: number; rows: number }
  | { type: "terminal_input"; data: string }
  | { type: "terminal_resize"; cols: number; rows: number }
  | { type: "terminal_stop" };

// ---------------------------------------------------------------------------
// Archives: a real, persistent, on-disk bundle of BOTH a session's workspace
// files and its recorded event history together - ported from Agent Loop's
// ArchiveStore (aicodingagent-ts/server/src/archive.ts), ADR: one archive =
// one teachable moment, files and the trace that produced them, not two
// separate save flows. Saved under <repo>/.archives/<id>/ as manifest.json +
// history.json + workspace/, distinct from the per-session sandbox at
// <repo>/.workspaces/<session-id>/ that disappears with the session.
// "Loading" one writes those real files into the CURRENT session's live
// workspace AND returns the paired history for the client to replay - not
// just one half of what happened.
// ---------------------------------------------------------------------------

export interface ArchiveMeta {
  id: string;
  title: string;
  archivedAt: string;
  fileCount: number;
  turns: number;
  events: number;
}

// ---------------------------------------------------------------------------
// Session history: the EVENT TRACE. Recorded continuously and automatically
// as events arrive (ported from Agent Loop's history.ts / store.ts apply()) -
// there is no manual "save session" step. Replayed entirely client-side by
// re-running the same reducer the live socket feeds; pair with the matching
// archive (above) to also get the real files back.
// ---------------------------------------------------------------------------

export interface RecordedSession {
  id: string;
  createdAt: string;
  workspacePath: string;
  events: TraceEvent[];
}

// ---------------------------------------------------------------------------
// Portable bundle: files + history together, as ONE downloadable/importable
// artifact (a plain .json file on your machine) - not two separate exports.
// This is the download-and-move-anywhere counterpart to a server-side
// Archive (above): an Archive is a one-click checkpoint that stays on this
// server's disk; a bundle is a file you can save to Desktop, hand to someone
// else, or re-import into a different browser/session entirely.
// ---------------------------------------------------------------------------

export interface WorkspaceBundle {
  version: 1;
  savedAt: string;
  history: RecordedSession;
  files: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal-components manifest shape (allowlist, source served on request)
// ---------------------------------------------------------------------------

export interface InternalComponentFunction {
  name: string;
  purpose: string;
  tooltip: string;
}

export interface InternalComponentMeta {
  id: string;
  label: string;
  description: string;
  path: string;
  events: string[];
  functions: InternalComponentFunction[];
}

export interface InternalComponent extends InternalComponentMeta {
  source: string;
}
