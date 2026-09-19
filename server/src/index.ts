/**
 * Cordis Interactive Tutorial - server entry.
 *
 * One Node process, one job that matters: a real, instrumented
 * @deepseek-ai/cordis Context, shared per session across both modes -
 *   1. Guided chapters (fixed plugin sets, for learning the primitives).
 *   2. Agent mode: a real DeepSeek-backed coding agent with file tools plus
 *      mount_plugin, writing and activating real Cordis plugins in the same
 *      Context. This is the actual point: rehearsing the skill ACRYL's own
 *      agent needs for self-building.
 *
 * Run in dev with `pnpm --filter @cordis-tutorial/server dev` (Vite proxies
 * /api and /ws here in dev; see web/vite.config.ts).
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  CHAPTERS,
  DEFAULT_MAX_STEPS,
  DEFAULT_SPEED_MS,
  PROVIDERS,
  type ChapterId,
  type ClientMessage,
  type ProviderConfig,
  type TraceEvent,
} from '@cordis-tutorial/shared'
import { getInternalComponents } from './internal-components.js'
import { createInstrumentedContext, type Instrumented } from './cordis-instrumentation.js'
import { CHAPTER_RUNNERS } from './chapters/index.js'
import type { Teardown } from './chapters/types.js'
import { Workspace } from './workspace.js'
import { buildTools, type Tool } from './tools/registry.js'
import { Agent } from './agent.js'
import { AgentControl } from './control.js'
import { createProvider } from './providers/types.js'
import { ArchiveStore } from './archive.js'
import * as pty from 'node-pty'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const webDist = path.join(repoRoot, 'web', 'dist')
// One persistent, shared workspace directory for the whole server - ported
// from aicodingagent-ts's `const workspace = new Workspace(workspaceRoot)`
// (module-scoped, created once). Earlier this minted a fresh random-UUID
// directory under .workspaces/ per WebSocket connection, so every page
// reload left an abandoned directory behind - not what the reference does.
const workspaceRoot = path.resolve(process.env.CORDIS_TUTORIAL_WORKSPACE || path.join(repoRoot, 'workspace'))
const workspace = new Workspace(workspaceRoot)
const archives = new ArchiveStore(repoRoot)

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/chapters', (_req, res) => {
  res.json({ chapters: CHAPTERS })
})

app.get('/api/internal-components', async (_req, res) => {
  try {
    res.json({ components: await getInternalComponents(repoRoot) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Live session registry, keyed by session id - lets REST endpoints (which
// carry no WebSocket of their own) reach a session's real workspace, the
// same one its WS connection is writing to.
const sessions = new Map<string, Session>()

// Full current file contents for a session's live workspace - the diff
// baseline Workspace.tsx needs (ported from aicodingagent-ts's identical
// endpoint), not just the list of names session_start already sends.
app.get('/api/workspace/snapshot', async (req, res) => {
  const id = String(req.query.session ?? '')
  const session = sessions.get(id)
  if (!session) {
    res.status(404).json({ error: `unknown session: ${id}` })
    return
  }
  res.json({ workspacePath: session.workspace.root, files: await session.workspace.list(), snapshot: await session.workspace.snapshot() })
})

// A single file's current content, for a file the initial session_start
// snapshot omitted (over the 500KB inline-snapshot cap) - ported alongside
// the snapshot endpoint above.
app.get('/api/workspace/file', async (req, res) => {
  const id = String(req.query.session ?? '')
  const rel = String(req.query.path ?? '')
  const session = sessions.get(id)
  if (!session) {
    res.status(404).json({ error: `unknown session: ${id}` })
    return
  }
  try {
    const content = await session.workspace.readFile(rel)
    res.type('text/plain').send(content)
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Serves a chapter's own real server-side source - the actual code that just
// ran, not a description of it. Allowlisted to exactly the known chapter ids
// (never an arbitrary path) and resolved against this file's own directory.
app.get('/api/chapters/:id/source', async (req, res) => {
  const id = req.params.id
  if (!Object.prototype.hasOwnProperty.call(CHAPTER_RUNNERS, id)) {
    res.status(404).json({ error: `unknown chapter: ${id}` })
    return
  }
  try {
    const { readFile } = await import('node:fs/promises')
    const filePath = path.join(__dirname, 'chapters', `${id}.ts`)
    const source = await readFile(filePath, 'utf8')
    res.json({ path: `server/src/chapters/${id}.ts`, source })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Production: serve the built frontend.
app.use(express.static(webDist, { index: 'index.html', fallthrough: true }))

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

interface Session {
  ws: WebSocket
  id: string
  workspace: Workspace
  instr: Instrumented
  tools: Tool[]
  agent: Agent | null
  control: AgentControl
  chapterRunning: boolean
  chapterTeardown: Teardown | null
  agentRunning: boolean
  providerConfig: ProviderConfig | null
  pty: pty.IPty | null
}

function send(ws: WebSocket, event: TraceEvent): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event))
}

wss.on('connection', (ws) => {
  const id = randomUUID()
  const emit = (event: TraceEvent) => send(ws, event)

  // Session setup below does real async I/O (workspace.list()/.snapshot()).
  // If ws.on('message') were only attached after that finished, a message
  // the client sends immediately on its own 'open' event - which routinely
  // fires before this async work completes - would arrive with no listener
  // registered yet and be silently dropped (verified: this was exactly why
  // run_chapter appeared to hang with nothing past session_start). Attach
  // the listener synchronously, before any await, and buffer raw messages
  // until the session is actually ready.
  let session: Session | null = null
  const backlog: Buffer[] = []

  ws.on('message', (raw) => {
    if (!session) {
      backlog.push(Buffer.from(raw as ArrayBuffer))
      return
    }
    handleMessage(session, raw)
  })

  void (async () => {
    // The shared, already-ensured workspace above - not a fresh one per
    // connection. `id` here only identifies this WS connection/Context
    // instance (for the session registry and REST lookups), not a
    // directory on disk.
    session = {
      ws,
      id,
      workspace,
      instr: createInstrumentedContext(emit),
      tools: buildTools(),
      agent: null,
      control: new AgentControl(),
      chapterRunning: false,
      chapterTeardown: null,
      agentRunning: false,
      providerConfig: null,
      pty: null,
    }
    sessions.set(id, session)

    send(ws, {
      type: 'session_start',
      sessionId: id,
      chapters: CHAPTERS,
      workspaceFiles: await workspace.list(),
      workspacePath: workspace.root,
      workspaceSnapshot: await workspace.snapshot(),
    })

    for (const raw of backlog.splice(0)) handleMessage(session, raw)
  })()

  ws.on('close', () => {
    if (session) {
      sessions.delete(session.id)
      void stopChapter(session)
      session.control.stop()
      // A leaked shell process per abandoned connection is exactly the
      // class of bug this project already had twice with workspace dirs
      // and Cordis Contexts - kill the real PTY here too.
      session.pty?.kill()
    }
  })
})

function handleMessage(session: Session, raw: unknown): void {
  const { ws } = session
  const emit = (event: TraceEvent) => send(ws, event)
  void (async () => {
    let msg: ClientMessage
    try {
      msg = JSON.parse((raw as { toString(): string }).toString()) as ClientMessage
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON', fatal: false })
      return
    }

    switch (msg.type) {
      case 'connect':
        return

      case 'stop': {
        await stopChapter(session)
        session.control.stop()
        return
      }

      case 'run_chapter': {
        if (session.chapterRunning) {
          send(ws, { type: 'error', message: 'Stop the current chapter before starting another.', fatal: false })
          return
        }
        session.chapterRunning = true
        runChapter(session, msg.chapter)
          .catch((err) => send(ws, { type: 'error', message: String(err), fatal: false }))
          .finally(() => { session.chapterRunning = false })
        return
      }

      case 'configure': {
        session.providerConfig = {
          provider: msg.provider,
          model: msg.model,
          apiKey: msg.apiKey,
          baseURL: msg.baseURL || PROVIDERS.find((p) => p.id === msg.provider)?.baseURL,
        }
        // Volume 2's llm.mjs (workspace-authored, chapter 22) reads these -
        // a completely standard, portable Node convention (matches chapter
        // 5's own !!js process.env.X config example) that lets the agent
        // write and reason about a placeholder env var name without ever
        // putting the real secret in its own transcript. Process-global, so
        // two concurrent sessions on one server share one active provider -
        // an acceptable limitation for this local, single-user teaching
        // tool, not a production multi-tenant concern.
        process.env.CORDIS_AGENT_PROVIDER = session.providerConfig.provider
        process.env.CORDIS_AGENT_MODEL = session.providerConfig.model
        process.env.CORDIS_AGENT_API_KEY = session.providerConfig.apiKey
        process.env.CORDIS_AGENT_BASE_URL = session.providerConfig.baseURL ?? ''
        return
      }

      case 'test_connection': {
        const provider = createProvider({
          provider: msg.provider,
          model: msg.model,
          apiKey: msg.apiKey,
          baseURL: msg.baseURL || PROVIDERS.find((p) => p.id === msg.provider)?.baseURL,
        })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)
        try {
          const resp = await provider.chat([{ role: 'user', content: 'Reply with the single word "ok".' }], [], undefined, controller.signal)
          send(ws, { type: 'connection_test_result', ok: true, message: `${msg.model}: ${resp.text.trim().slice(0, 60) || '(empty reply, but the call succeeded)'}` })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          send(ws, { type: 'connection_test_result', ok: false, message: message.slice(0, 200) })
        } finally {
          clearTimeout(timeout)
        }
        return
      }

      case 'run': {
        if (!session.providerConfig) {
          send(ws, { type: 'error', message: 'Configure a DeepSeek API key first.', fatal: false })
          return
        }
        if (session.agentRunning) {
          send(ws, { type: 'error', message: 'The agent is already running.', fatal: false })
          return
        }
        session.agentRunning = true
        session.control = new AgentControl()
        const provider = createProvider(session.providerConfig)
        const opts = {
          provider,
          workspace: session.workspace,
          tools: session.tools,
          emit,
          instr: session.instr,
          maxSteps: DEFAULT_MAX_STEPS,
          speedMs: DEFAULT_SPEED_MS,
          control: session.control,
        }
        if (!session.agent) session.agent = new Agent(opts)
        else session.agent.updateOptions(opts)
        emit({ type: 'status', status: 'running' })
        session.agent.runTurn(msg.message)
          .catch((err) => send(ws, { type: 'error', message: String(err), fatal: false }))
          .finally(() => { session.agentRunning = false })
        return
      }

      case 'reset_workspace': {
        // Wipes the real files back to the seeded starter state - for
        // starting a fresh teaching session. Emits the fresh file list AND
        // their content together (workspace_reset), not just the list, so
        // the client can drop every stale fileContents/baselineContents
        // entry in one step instead of accumulating ghosts of deleted files.
        await session.workspace.reset()
        const files = await session.workspace.list()
        const snapshot = await session.workspace.snapshot()
        send(ws, { type: 'workspace_reset', files, snapshot })
        return
      }

      case 'save_file': {
        // A direct human edit from the Monaco editor, not a tool call the
        // agent made - writes to the real file the same way write_file does,
        // and reuses the same file_changed/workspace_files events so the
        // store's existing reducer needs no new case.
        try {
          const action = await session.workspace.writeFile(msg.path, msg.content)
          send(ws, { type: 'file_changed', path: msg.path, action, content: msg.content })
          send(ws, { type: 'workspace_files', files: await session.workspace.list() })
        } catch (err) {
          send(ws, { type: 'error', message: `Save failed: ${err instanceof Error ? err.message : String(err)}`, fatal: false })
        }
        return
      }

      case 'restore_bundle': {
        // Writes every real file from an imported .json bundle into this
        // session's live workspace in one round trip - the counterpart to
        // "archive current"'s combined save, for a bundle that came from an
        // uploaded file rather than the server's own .archives/.
        try {
          for (const [path, content] of Object.entries(msg.files)) {
            const action = await session.workspace.writeFile(path, content)
            send(ws, { type: 'file_changed', path, action, content })
          }
          send(ws, { type: 'workspace_files', files: await session.workspace.list() })
        } catch (err) {
          send(ws, { type: 'error', message: `Restore failed: ${err instanceof Error ? err.message : String(err)}`, fatal: false })
        }
        return
      }

      case 'archive_current': {
        try {
          // Bundles the session's real workspace files with the event
          // history the client just sent - one archive, both halves of what
          // happened (ported from aicodingagent-ts's ArchiveStore.create()).
          const archive = await archives.create(session.workspace, msg.history, msg.title)
          send(ws, { type: 'archive_saved', archive })
        } catch (err) {
          send(ws, { type: 'error', message: `Archive save failed: ${err instanceof Error ? err.message : String(err)}`, fatal: false })
        }
        return
      }

      case 'list_archives': {
        try {
          send(ws, { type: 'archive_list', archives: await archives.list() })
        } catch (err) {
          send(ws, { type: 'error', message: `Archive list failed: ${err instanceof Error ? err.message : String(err)}`, fatal: false })
        }
        return
      }

      case 'load_archive': {
        try {
          // Auto-archives whatever the client currently has (if anything)
          // before overwriting this session's live workspace, so loading a
          // past archive never silently discards unsaved work - matching
          // aicodingagent-ts's load-archive route.
          if (msg.currentHistory && msg.currentHistory.events.length > 0) {
            await archives.create(session.workspace, msg.currentHistory, '')
          }
          // Writes the archive's REAL files into this session's live
          // workspace - the running Context can mount_plugin them
          // immediately - and returns its paired history for replay.
          const { meta, files, history } = await archives.restore(msg.id, session.workspace)
          const snapshot = await session.workspace.snapshot()
          send(ws, { type: 'archive_loaded', archive: meta, files, snapshot, history })
          send(ws, { type: 'workspace_files', files })
        } catch (err) {
          send(ws, { type: 'error', message: `Archive load failed: ${err instanceof Error ? err.message : String(err)}`, fatal: false })
        }
        return
      }

      case 'terminal_start': {
        // One real shell PTY per session, cwd'd at the real workspace
        // directory - so `ls`, `pnpm install`, `node run.mjs` genuinely
        // operate on the same files the file tree and mount_plugin see.
        // Re-starting while one is already running just resizes it instead
        // of leaking a second shell.
        if (session.pty) {
          session.pty.resize(Math.max(1, msg.cols), Math.max(1, msg.rows))
          return
        }
        const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
        const proc = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: Math.max(1, msg.cols),
          rows: Math.max(1, msg.rows),
          cwd: session.workspace.root,
          env: process.env,
        })
        session.pty = proc
        proc.onData((data) => send(ws, { type: 'terminal_output', data }))
        proc.onExit(({ exitCode }) => {
          session.pty = null
          send(ws, { type: 'terminal_exit', exitCode })
        })
        send(ws, { type: 'terminal_started', shell })
        return
      }

      case 'terminal_input': {
        session.pty?.write(msg.data)
        return
      }

      case 'terminal_resize': {
        session.pty?.resize(Math.max(1, msg.cols), Math.max(1, msg.rows))
        return
      }

      case 'terminal_stop': {
        session.pty?.kill()
        session.pty = null
        return
      }

      default: {
        const _exhaustive: never = msg
        void _exhaustive
        return
      }
    }
  })()
}

async function stopChapter(session: Session): Promise<void> {
  if (session.chapterTeardown) {
    const teardown = session.chapterTeardown
    session.chapterTeardown = null
    await teardown()
  }
}

async function runChapter(session: Session, chapterId: ChapterId): Promise<void> {
  await stopChapter(session)

  const runner = CHAPTER_RUNNERS[chapterId]
  const emit = session.instr.emit

  emit({ type: 'chapter_change', chapter: chapterId })
  emit({ type: 'chapter_start', chapter: chapterId, title: runner.title })
  try {
    session.chapterTeardown = await runner.run(session.instr)
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err), fatal: false })
  }
  emit({ type: 'chapter_end', chapter: chapterId })
}

const PORT = Number(process.env.PORT) || 8788
void workspace.ensure().then(() => {
  server.listen(PORT, () => {
    console.log(`Cordis Interactive Tutorial server listening on http://localhost:${PORT}`)
    console.log(`  workspace:  ${workspaceRoot}`)
    console.log(`  web/dist:   ${webDist} (served in production)`)
  })
})
