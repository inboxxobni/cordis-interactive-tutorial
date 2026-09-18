/**
 * Real, persistent, on-disk archives bundling BOTH a session's workspace
 * files and its recorded event history together - ported from Agent Loop's
 * ArchiveStore (aicodingagent-ts/server/src/archive.ts): one archive is one
 * teachable moment (the files AND the trace that produced them), not two
 * separate save flows. Saved under <repo>/.archives/<id>/ as manifest.json +
 * history.json + workspace/, distinct from the per-session sandbox under
 * .workspaces/<session-id>/ that disappears with the session.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ArchiveMeta, RecordedSession } from '@cordis-tutorial/shared'
import type { Workspace } from './workspace.js'

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store'])

interface ArchiveManifest extends ArchiveMeta {
  version: 1
  historyFile: 'history.json'
  workspaceDirectory: 'workspace'
}

export class ArchiveStore {
  readonly root: string

  constructor(repoRoot: string, private readonly now: () => Date = () => new Date()) {
    this.root = path.join(repoRoot, '.archives')
  }

  async list(): Promise<ArchiveMeta[]> {
    await fs.mkdir(this.root, { recursive: true })
    const entries = await fs.readdir(this.root, { withFileTypes: true })
    const archives = await Promise.all(
      entries.filter((e) => e.isDirectory()).map(async (e) => {
        try {
          const raw = await fs.readFile(path.join(this.root, e.name, 'manifest.json'), 'utf8')
          return JSON.parse(raw) as ArchiveManifest
        } catch {
          return null
        }
      }),
    )
    return archives.filter((a): a is ArchiveManifest => a !== null).sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
  }

  /** Bundles the given workspace's real current files with the given recorded history into one new archive. */
  async create(workspace: Workspace, history: RecordedSession, title: string): Promise<ArchiveMeta> {
    await fs.mkdir(this.root, { recursive: true })
    const now = this.now()
    const resolvedTitle = title.trim() || titleFrom(history)
    let id = `${resolvedTitle}_${timestamp(now)}`
    let suffix = 2
    while (await exists(path.join(this.root, id))) id = `${resolvedTitle}_${timestamp(now)}-${suffix++}`
    const target = path.join(this.root, id)
    const workspaceTarget = path.join(target, 'workspace')
    await fs.mkdir(target, { recursive: true })
    await copyDir(workspace.root, workspaceTarget)

    const meta: ArchiveMeta = {
      id,
      title: resolvedTitle,
      archivedAt: now.toISOString(),
      fileCount: await countFiles(workspaceTarget),
      turns: history.events.filter((e) => e.type === 'turn_start').length,
      events: history.events.length,
    }
    const manifest: ArchiveManifest = { ...meta, version: 1, historyFile: 'history.json', workspaceDirectory: 'workspace' }
    await Promise.all([
      fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'),
      fs.writeFile(path.join(target, 'history.json'), JSON.stringify(history, null, 2), 'utf8'),
    ])
    return meta
  }

  /** Writes an archive's real files into the given (current) session's live workspace and returns its paired history. */
  async restore(id: string, workspace: Workspace): Promise<{ meta: ArchiveMeta; history: RecordedSession; files: string[] }> {
    const target = this.resolveArchive(id)
    const [manifestText, historyText] = await Promise.all([
      fs.readFile(path.join(target, 'manifest.json'), 'utf8'),
      fs.readFile(path.join(target, 'history.json'), 'utf8'),
    ])
    const meta = JSON.parse(manifestText) as ArchiveManifest
    const history = JSON.parse(historyText) as RecordedSession
    await clearDir(workspace.root)
    await copyDir(path.join(target, 'workspace'), workspace.root)
    return { meta, history, files: await workspace.list() }
  }

  private resolveArchive(id: string): string {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new Error('Invalid archive id.')
    return path.join(this.root, id)
  }
}

async function copyDir(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true })
  const entries = await fs.readdir(source, { withFileTypes: true }).catch(() => [] as import('node:fs').Dirent[])
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue
    await fs.cp(path.join(source, entry.name), path.join(target, entry.name), { recursive: true, force: true })
  }
}

async function clearDir(root: string): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [] as import('node:fs').Dirent[])
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue
    await fs.rm(path.join(root, entry.name), { recursive: true, force: true })
  }
}

async function countFiles(root: string): Promise<number> {
  let total = 0
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(path.join(dir, entry.name))
      else total += 1
    }
  }
  await walk(root)
  return total
}

function titleFrom(history: RecordedSession): string {
  const prompt = history.events.find((e) => e.type === 'turn_start')
  const message = prompt && 'userMessage' in prompt ? prompt.userMessage : undefined
  const words = typeof message === 'string' ? message.toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 6).join('-') : ''
  return words || 'cordis-session'
}

function timestamp(date: Date): string {
  const part = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${part(date.getUTCMonth() + 1)}-${part(date.getUTCDate())}_${part(date.getUTCHours())}-${part(date.getUTCMinutes())}-${part(date.getUTCSeconds())}`
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
