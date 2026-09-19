import { create } from "zustand";
import type { ArchiveMeta, ChapterId, ChapterInfo, FiberState, ProviderId, RecordedSession, TraceEvent, WorkspaceBundle } from "@cordis-tutorial/shared";
import { CHAPTERS, PROVIDERS } from "@cordis-tutorial/shared";
import { TutorialSocket } from "./ws";

export interface PluginNode {
  id: string;
  name: string;
  state: FiberState;
  hasInject: boolean;
  inject: string[];
  /** Real but NOT `inject`-declared service reads (ctx.get(), not a hard
   * dependency Cordis tracks structurally) - populated from real
   * `service_inject` events a plugin explicitly reports at its own real
   * ctx.get() call site (Cordis has no generic hook for this, same reason
   * ctx.effect()/ctx.on() need reportEffect/reportListen). Drawn as a
   * distinct, lighter edge from a hard `inject` one. */
  softInject: string[];
  sourcePath?: string;
}

export interface LogLine {
  id: number;
  text: string;
  kind: TraceEvent["type"];
}

export interface ChatLine {
  id: number;
  role: "user" | "assistant" | "tool";
  text: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface ProviderFormConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}
type ProviderConfigs = Partial<Record<ProviderId, ProviderFormConfig>>;

interface State {
  connected: boolean;
  sessionId: string | null;
  chapters: ChapterInfo[];
  activeChapter: ChapterId | null;
  chapterTitle: string | null;
  chapterRunning: boolean;
  plugins: Record<string, PluginNode>;
  /** serviceName -> the pluginId that provided it, from real service_provide events. */
  serviceProviders: Record<string, string>;
  log: LogLine[];
  lastComponentId: string | null;

  // Multi-provider settings
  activeProvider: ProviderId;
  providerConfigs: ProviderConfigs;
  configured: boolean;
  testing: boolean;
  testResult: ConnectionTestResult | null;

  // Agent mode
  agentRunning: boolean;
  agentStatus: string;
  chat: ChatLine[];
  streamingId: number | null;

  // Workspace (ported from aicodingagent-ts's Workspace.tsx / store.ts):
  // the file tree, the currently-opened file, its live content, and the
  // content snapshot taken at session_start (the diff baseline).
  workspaceFiles: string[];
  fileContents: Record<string, string>;
  baselineContents: Record<string, string>;
  openFile: string | null;
  /** The real filesystem path of THIS session's live workspace, on the server. */
  workspacePath: string | null;

  // Real, on-disk archives of the workspace (server-side, .archives/) -
  // each one bundles BOTH the workspace files and the paired event history.
  archives: ArchiveMeta[];
  archiving: boolean;

  // History / replay (ported from aicodingagent-ts's history.ts + store.ts):
  // every live event is recorded automatically into currentSession, which is
  // continuously pushed to the front of historySessions (localStorage) - no
  // manual "save" step. Selecting a past session enters step-through replay.
  historySessions: RecordedSession[];
  currentSession: RecordedSession | null;
  replaying: boolean;
  replayEventIndex: number;

  // Real terminal (node-pty on the server, xterm.js here) - one shell per
  // session, cwd'd at the real workspace directory. Output is NOT recorded
  // into history/replay (see apply()): it's raw shell noise, not curriculum
  // events, and would flood both the Live Trace log and every saved session.
  terminalRunning: boolean;
  terminalShell: string | null;
  terminalChunk: { seq: number; data: string } | null;

  // Real pluginId (the 'agentLoop' service's current provider) to pulse
  // briefly on canvas. Best-effort: set only when a real event_emit's
  // eventName starts with "agent-workspace/" - a convention this
  // tutorial's system prompt suggests to the connected agent for its own
  // agent-loop.mjs, not something every build will emit.
  activePulseId: string | null;

  connect: () => void;
  runChapter: (id: ChapterId) => void;
  stopChapter: () => void;
  setActiveProvider: (id: ProviderId) => void;
  updateProviderConfig: (id: ProviderId, patch: Partial<ProviderFormConfig>) => void;
  configure: () => void;
  testConnection: () => void;
  wipe: () => void;
  sendMessage: (text: string) => void;
  setOpenFile: (path: string | null) => void;
  saveFile: (path: string, content: string) => void;
  apply: (event: TraceEvent) => void;
  replaySession: (sessionIndex: number) => void;
  replayStep: (delta: number) => void;
  exitReplay: () => void;
  importSession: (session: RecordedSession) => void;
  archiveCurrent: (title: string) => void;
  listArchives: () => void;
  loadArchive: (id: string) => void;
  exportBundle: () => WorkspaceBundle | null;
  restoreBundle: (bundle: WorkspaceBundle) => void;
  resetWorkspace: () => void;
  startTerminal: (cols: number, rows: number) => void;
  sendTerminalInput: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  stopTerminal: () => void;
  clearActivePulse: () => void;
}

const CONFIGS_KEY = "cordis-tutorial:provider-configs";
const ACTIVE_PROVIDER_KEY = "cordis-tutorial:active-provider";
const HISTORY_KEY = "cordis-tutorial:history-v1";
const MAX_SESSIONS = 20;
const MAX_EVENTS = 3000;

function providerInfo(id: ProviderId) {
  return PROVIDERS.find((p) => p.id === id)!;
}

function loadProviderConfigs(): ProviderConfigs {
  try {
    const raw = localStorage.getItem(CONFIGS_KEY);
    if (raw) return JSON.parse(raw) as ProviderConfigs;
  } catch {
    // ignore
  }
  return {};
}

function saveProviderConfigs(configs: ProviderConfigs): void {
  try {
    localStorage.setItem(CONFIGS_KEY, JSON.stringify(configs));
  } catch {
    // ignore
  }
}

function loadActiveProvider(): ProviderId {
  try {
    const raw = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    if (raw && PROVIDERS.some((p) => p.id === raw)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return "deepseek";
}

function loadHistory(): RecordedSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    if (Array.isArray(raw)) return raw.slice(0, MAX_SESSIONS);
  } catch {
    // ignore
  }
  return [];
}

function saveHistory(sessions: RecordedSession[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // localStorage quota full must not interrupt a live run
  }
}

function newSession(workspacePath = ""): RecordedSession {
  return { id: `session-${Date.now()}`, createdAt: new Date().toISOString(), workspacePath, events: [] };
}

function recordEvent(session: RecordedSession, event: TraceEvent): RecordedSession {
  const events = [...session.events, event];
  return { ...session, events: events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events };
}

let nextLogId = 0;
let nextChatId = 0;
let socket: TutorialSocket | null = null;

function describe(event: TraceEvent): string {
  switch (event.type) {
    case "session_start":
      return `connected (session ${event.sessionId.slice(0, 8)})`;
    case "chapter_change":
      return `switched to ${event.chapter}`;
    case "chapter_start":
      return `chapter: ${event.title}`;
    case "chapter_end":
      return `chapter finished`;
    case "plugin_register":
      return `plugin_register  ${event.name}${event.sourcePath ? ` (${event.sourcePath})` : ""}${event.hasInject ? ` [inject: ${event.inject.join(", ")}]` : ""}`;
    case "fiber_state_change":
      return `${event.pluginId}: ${event.from ?? "—"} → ${event.to}`;
    case "service_provide":
      return `${event.pluginId} provides "${event.serviceName}"`;
    case "service_inject":
      return `${event.pluginId} injects "${event.serviceName}"`;
    case "effect_acquire":
      return `${event.pluginId}: effect acquired — ${event.label}`;
    case "effect_dispose":
      return `${event.pluginId}: effect disposed — ${event.label}`;
    case "event_listen":
      return `${event.pluginId} listens for "${event.eventName}"`;
    case "event_emit":
      return `event emitted: "${event.eventName}"`;
    case "config_validate":
      return `${event.pluginId} config ${event.valid ? "valid" : "invalid"}`;
    case "config_error":
      return `${event.pluginId} config error: ${event.message}`;
    case "patch_applied":
      return event.description;
    case "hmr_reload":
      return `${event.pluginId} hot-reloaded`;
    case "plugin_unmount":
      return `${event.pluginId} unmounted`;
    case "log":
      return event.pluginId ? `${event.pluginId}: ${event.message}` : event.message;
    case "turn_start":
      return `turn ${event.turn}: "${event.userMessage.slice(0, 60)}"`;
    case "loop_start":
      return `iteration ${event.iteration}/${event.maxSteps} (${event.contextTokens} tok)`;
    case "llm_request":
      return `llm_request → ${event.model}`;
    case "llm_delta":
      return "";
    case "llm_response":
      return `llm_response (${event.toolCalls.length} tool call(s))`;
    case "assistant_message":
      return "";
    case "tool_call_start":
      return `tool_call: ${event.toolCall.name}(${JSON.stringify(event.toolCall.input).slice(0, 80)})`;
    case "tool_result":
      return `${event.name} → ${event.isError ? "error: " : ""}${event.result.slice(0, 100)}`;
    case "file_changed":
      return `file ${event.action}: ${event.path}`;
    case "workspace_files":
      return `workspace: ${event.files.length} file(s)`;
    case "workspace_reset":
      return `workspace cleared - back to ${event.files.length} starter file(s)`;
    case "loop_end":
      return `loop_end (${event.stopReason})`;
    case "turn_end":
      return `turn_end after ${event.steps} step(s)`;
    case "max_steps_reached":
      return `max steps (${event.maxSteps}) reached`;
    case "status":
      return `status: ${event.status}`;
    case "connection_test_result":
      return `connection test: ${event.ok ? "ok" : "failed"} - ${event.message}`;
    case "archive_list":
      return `${event.archives.length} archive(s) on disk`;
    case "archive_saved":
      return `archived: "${event.archive.title}" (${event.archive.fileCount} file(s), ${event.archive.events} event(s))`;
    case "archive_loaded":
      return `loaded archive "${event.archive.title}" into the live workspace (${event.files.length} file(s))`;
    case "terminal_started":
      return `terminal: ${event.shell}`;
    case "terminal_output":
      return "";
    case "terminal_exit":
      return `terminal exited (code ${event.exitCode})`;
    case "error":
      return `error: ${event.message}`;
  }
}

function componentForEvent(event: TraceEvent, activeChapter: ChapterId | null): string | null {
  if (event.type === "plugin_register" || event.type === "fiber_state_change" || event.type === "service_provide" || event.type === "event_emit") {
    if (!activeChapter) return "instrumentation";
    return `chapter-${activeChapter.slice(0, 2)}`;
  }
  return null;
}

/** Clears the visualization (canvas, log, chat) without touching connection/provider/workspace state - shared by replay entry, stepping, and exit. */
function resetVisualization(set: (partial: Partial<State>) => void) {
  set({
    plugins: {},
    serviceProviders: {},
    log: [],
    lastComponentId: null,
    chat: [],
    streamingId: null,
    activeChapter: null,
    chapterTitle: null,
    chapterRunning: false,
    agentStatus: "idle",
  });
}

export const useStore = create<State>((set, get) => ({
  connected: false,
  sessionId: null,
  chapters: CHAPTERS,
  activeChapter: null,
  chapterTitle: null,
  chapterRunning: false,
  plugins: {},
  serviceProviders: {},
  log: [],
  lastComponentId: null,

  activeProvider: loadActiveProvider(),
  providerConfigs: loadProviderConfigs(),
  configured: false,
  testing: false,
  testResult: null,

  agentRunning: false,
  agentStatus: "idle",
  chat: [],
  streamingId: null,

  workspaceFiles: [],
  fileContents: {},
  baselineContents: {},
  openFile: null,
  workspacePath: null,

  archives: [],
  archiving: false,

  historySessions: loadHistory(),
  currentSession: null,
  replaying: false,
  replayEventIndex: -1,

  terminalRunning: false,
  terminalShell: null,
  terminalChunk: null,

  activePulseId: null,

  connect: () => {
    if (socket) return;
    socket = new TutorialSocket({
      onOpen: () => {
        set({ connected: true });
        const cfg = get().providerConfigs[get().activeProvider];
        if (cfg?.apiKey) get().configure();
      },
      onClose: () => set({ connected: false }),
      onEvent: (event) => get().apply(event),
    });
    socket.connect();
  },

  runChapter: (id) => {
    set({ plugins: {}, serviceProviders: {}, log: [], activeChapter: id, chapterRunning: true });
    socket?.send({ type: "run_chapter", chapter: id });
  },

  stopChapter: () => {
    socket?.send({ type: "stop" });
    set({ chapterRunning: false });
  },

  setActiveProvider: (id) => {
    set({ activeProvider: id, configured: false, testResult: null });
    try {
      localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
    } catch {
      // ignore
    }
  },

  updateProviderConfig: (id, patch) => {
    set((s) => {
      const existing = s.providerConfigs[id] ?? { apiKey: "", baseURL: providerInfo(id).baseURL, model: providerInfo(id).models[0] ?? "" };
      const configs = { ...s.providerConfigs, [id]: { ...existing, ...patch } };
      saveProviderConfigs(configs);
      return { providerConfigs: configs, configured: false, testResult: null };
    });
  },

  configure: () => {
    const { activeProvider, providerConfigs } = get();
    const cfg = providerConfigs[activeProvider] ?? { apiKey: "", baseURL: providerInfo(activeProvider).baseURL, model: providerInfo(activeProvider).models[0] ?? "" };
    socket?.send({ type: "configure", provider: activeProvider, model: cfg.model, apiKey: cfg.apiKey, baseURL: cfg.baseURL });
    set({ configured: true });
  },

  testConnection: () => {
    const { activeProvider, providerConfigs } = get();
    const cfg = providerConfigs[activeProvider];
    if (!cfg?.apiKey && providerInfo(activeProvider).keyHint !== "(no key needed)") return;
    set({ testing: true, testResult: null });
    socket?.send({ type: "test_connection", provider: activeProvider, model: cfg?.model || providerInfo(activeProvider).models[0] || "", apiKey: cfg?.apiKey ?? "", baseURL: cfg?.baseURL });
  },

  wipe: () => {
    try {
      localStorage.removeItem(CONFIGS_KEY);
      localStorage.removeItem(ACTIVE_PROVIDER_KEY);
    } catch {
      // ignore
    }
    set({ providerConfigs: {}, activeProvider: "deepseek", configured: false, testResult: null, testing: false });
  },

  sendMessage: (text) => {
    const id = nextChatId++;
    set((s) => ({ chat: [...s.chat, { id, role: "user", text }], agentRunning: true }));
    socket?.send({ type: "run", message: text });
  },

  setOpenFile: (path) => set({ openFile: path }),

  saveFile: (path, content) => {
    // Optimistic local update - the server's file_changed echo (below) will
    // confirm it, but the editor shouldn't visibly lag a successful save.
    set((s) => ({ fileContents: { ...s.fileContents, [path]: content } }));
    socket?.send({ type: "save_file", path, content });
  },

  apply: (event) => {
    set((state) => {
      const text = describe(event);
      const log = text ? [...state.log, { id: nextLogId++, text, kind: event.type }].slice(-400) : state.log;
      const lastComponentId = componentForEvent(event, state.activeChapter) ?? state.lastComponentId;
      const next: Partial<State> = { log, lastComponentId };

      // Continuous auto-recording (ported from aicodingagent-ts): every live
      // event lands in currentSession, which is always the most recent entry
      // in historySessions - there is no manual "save" step. Replaying an old
      // session suspends this (state.replaying is true) so stepping through
      // history doesn't record itself. terminal_output is excluded on
      // purpose - raw shell bytes on every keystroke are not a curriculum
      // event, and would flood every saved/exported session.
      if (!state.replaying && event.type !== "terminal_output") {
        const base = state.currentSession ?? newSession(event.type === "session_start" ? event.workspacePath : state.workspacePath ?? "");
        const session = recordEvent(base, event);
        const historySessions = [session, ...state.historySessions.filter((s) => s.id !== session.id)].slice(0, MAX_SESSIONS);
        next.currentSession = session;
        next.historySessions = historySessions;
        saveHistory(historySessions);
      }

      if (event.type === "session_start") {
        next.sessionId = event.sessionId;
        next.chapters = event.chapters;
        next.workspaceFiles = event.workspaceFiles;
        next.workspacePath = event.workspacePath;
        next.baselineContents = event.workspaceSnapshot;
        const openFile = state.openFile ?? event.workspaceFiles.find((f) => f === "README.md") ?? event.workspaceFiles.find((f) => !f.endsWith("/")) ?? null;
        next.openFile = openFile;
        next.fileContents = { ...state.fileContents, ...event.workspaceSnapshot };
      } else if (event.type === "chapter_start") {
        next.chapterTitle = event.title;
      } else if (event.type === "chapter_end") {
        next.chapterRunning = false;
      } else if (event.type === "plugin_register") {
        next.plugins = {
          ...state.plugins,
          [event.pluginId]: { id: event.pluginId, name: event.name, state: "PENDING", hasInject: event.hasInject, inject: event.inject, softInject: [], sourcePath: event.sourcePath },
        };
      } else if (event.type === "fiber_state_change") {
        const existing = state.plugins[event.pluginId];
        if (existing) next.plugins = { ...state.plugins, [event.pluginId]: { ...existing, state: event.to } };
      } else if (event.type === "service_provide") {
        next.serviceProviders = { ...state.serviceProviders, [event.serviceName]: event.pluginId };
      } else if (event.type === "service_inject") {
        const existing = state.plugins[event.pluginId];
        if (existing && event.satisfied && !existing.softInject.includes(event.serviceName)) {
          next.plugins = { ...state.plugins, [event.pluginId]: { ...existing, softInject: [...existing.softInject, event.serviceName] } };
        }
      } else if (event.type === "workspace_files") {
        next.workspaceFiles = event.files;
      } else if (event.type === "workspace_reset") {
        // Drop every stale entry (including ones for files that no longer
        // exist) instead of merging - a reset means "forget the old files",
        // not "patch them".
        next.workspaceFiles = event.files;
        next.fileContents = event.snapshot;
        next.baselineContents = event.snapshot;
        next.openFile = null;
      } else if (event.type === "file_changed") {
        next.fileContents = { ...state.fileContents, [event.path]: event.content };
        if (state.openFile === null || !state.workspaceFiles.includes(event.path)) {
          next.workspaceFiles = state.workspaceFiles.includes(event.path) ? state.workspaceFiles : [...state.workspaceFiles, event.path];
          if (!state.openFile) next.openFile = event.path;
        }
      } else if (event.type === "assistant_message") {
        const id = state.streamingId ?? nextChatId++;
        const existingIdx = state.chat.findIndex((c) => c.id === id);
        const line: ChatLine = { id, role: "assistant", text: event.text };
        next.chat = existingIdx >= 0 ? state.chat.map((c) => (c.id === id ? line : c)) : [...state.chat, line];
        next.streamingId = null;
      } else if (event.type === "tool_call_start") {
        next.chat = [...state.chat, { id: nextChatId++, role: "tool", text: `${event.toolCall.name}(${JSON.stringify(event.toolCall.input)})` }];
      } else if (event.type === "tool_result") {
        next.chat = [...state.chat, { id: nextChatId++, role: "tool", text: `→ ${event.result.slice(0, 300)}` }];
      } else if (event.type === "status") {
        next.agentStatus = event.status;
        if (event.status === "done" || event.status === "error") next.agentRunning = false;
      } else if (event.type === "connection_test_result") {
        next.testing = false;
        next.testResult = { ok: event.ok, message: event.message };
      } else if (event.type === "archive_list") {
        next.archives = event.archives;
      } else if (event.type === "archive_saved") {
        next.archives = [event.archive, ...state.archives];
        next.archiving = false;
      } else if (event.type === "archive_loaded") {
        next.workspaceFiles = event.files;
        next.fileContents = { ...state.fileContents, ...event.snapshot };
        next.baselineContents = event.snapshot;
        next.archiving = false;
      } else if (event.type === "terminal_started") {
        next.terminalRunning = true;
        next.terminalShell = event.shell;
      } else if (event.type === "terminal_output") {
        next.terminalChunk = { seq: (state.terminalChunk?.seq ?? 0) + 1, data: event.data };
      } else if (event.type === "terminal_exit") {
        next.terminalRunning = false;
      } else if (event.type === "event_emit") {
        // Best-effort activity pulse: the connected agent's own
        // agent-loop.mjs (Volume 2) has no privileged emit() access - it
        // only ever gets `ctx`, so this relies on the ordinary, already-real
        // ctx.emit() a workspace plugin can call itself, observed through
        // the same generic internal/dispatch hook every event already
        // flows through. internal/dispatch doesn't reliably expose WHICH
        // fiber emitted it, so this pulses the whole agentLoop node rather
        // than guessing a specific edge - real, but coarser by necessity.
        if (event.eventName.startsWith("agent-workspace/")) {
          const pluginId = state.serviceProviders["agentLoop"];
          if (pluginId) next.activePulseId = pluginId;
        }
      } else if (event.type === "error") {
        next.agentRunning = false;
        next.testing = false;
      }

      return next as State;
    });
  },

  replaySession: (sessionIndex) => {
    const selected = get().historySessions[sessionIndex];
    if (!selected) return;
    resetVisualization(set);
    set({ currentSession: selected, replaying: true, replayEventIndex: -1 });
    // Show the first recorded event immediately - never leave the canvas
    // looking empty right after picking a session.
    if (selected.events.length > 0) {
      get().apply(selected.events[0]);
      set({ currentSession: selected, replaying: true, replayEventIndex: 0 });
    }
  },

  replayStep: (delta) => {
    const s = get();
    if (!s.replaying || !s.currentSession) return;
    const next = Math.max(-1, Math.min(s.currentSession.events.length - 1, s.replayEventIndex + delta));
    resetVisualization(set);
    set({ currentSession: s.currentSession, replaying: true, replayEventIndex: -1 });
    for (let i = 0; i <= next; i += 1) get().apply(s.currentSession.events[i]);
    set({ currentSession: s.currentSession, replaying: true, replayEventIndex: next });
  },

  exitReplay: () => {
    resetVisualization(set);
    set({ replaying: false, replayEventIndex: -1, currentSession: null });
  },

  importSession: (session) => {
    const historySessions = [session, ...get().historySessions.filter((item) => item.id !== session.id)].slice(0, MAX_SESSIONS);
    saveHistory(historySessions);
    set({ historySessions });
  },

  archiveCurrent: (title) => {
    const session = get().currentSession;
    if (!session || session.events.length === 0) return;
    set({ archiving: true });
    socket?.send({ type: "archive_current", title, history: session });
  },

  listArchives: () => {
    socket?.send({ type: "list_archives" });
  },

  loadArchive: (id) => {
    set({ archiving: true });
    socket?.send({ type: "load_archive", id, currentHistory: get().currentSession });
  },

  exportBundle: () => {
    const { currentSession, workspaceFiles, fileContents } = get();
    if (!currentSession || currentSession.events.length === 0) return null;
    const files: Record<string, string> = {};
    for (const path of workspaceFiles) {
      if (path.endsWith("/")) continue;
      if (fileContents[path] !== undefined) files[path] = fileContents[path];
    }
    return { version: 1, savedAt: new Date().toISOString(), history: currentSession, files };
  },

  restoreBundle: (bundle) => {
    get().importSession(bundle.history);
    socket?.send({ type: "restore_bundle", files: bundle.files });
  },

  resetWorkspace: () => {
    // Wipes the real files back to the seeded starter state and starts a
    // fresh recorded session - for "save what we have, then start clean for
    // the next class" without losing the old session (it's already sitting
    // in historySessions, archive it or export its bundle first if you want
    // the real files back later).
    resetVisualization(set);
    set({ currentSession: null, replaying: false, replayEventIndex: -1 });
    socket?.send({ type: "reset_workspace" });
  },

  startTerminal: (cols, rows) => {
    socket?.send({ type: "terminal_start", cols, rows });
  },

  sendTerminalInput: (data) => {
    socket?.send({ type: "terminal_input", data });
  },

  resizeTerminal: (cols, rows) => {
    socket?.send({ type: "terminal_resize", cols, rows });
  },

  stopTerminal: () => {
    socket?.send({ type: "terminal_stop" });
  },

  clearActivePulse: () => set({ activePulseId: null }),
}));
