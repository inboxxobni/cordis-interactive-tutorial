import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ToolDefinition } from '@cordis-tutorial/shared'

/**
 * The system prompt is a small router, not the architecture: the reference
 * docs and verified examples live in the workspace (seeded from
 * server/agent-context/) and the agent pulls only what the current task needs
 * with its own file tools. Same shape as pi.dev's system prompt: a docs
 * router (topic -> file, generated from a manifest), a "read fully and follow
 * cross-references before implementing" policy, and named sections so the
 * stable parts form a cacheable prefix and only the workspace listing at the
 * end changes turn to turn.
 */

interface ManifestItem {
  title: string
  path: string
  sandbox: 'applies' | 'partial' | 'acryl-only'
  when: string
}
interface Manifest {
  navigation: Array<{ title: string; items: ManifestItem[] }>
}

const DOCS_MANIFEST_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../agent-context/docs/docs.json')
const manifest = JSON.parse(readFileSync(DOCS_MANIFEST_PATH, 'utf8')) as Manifest

/** "Handbook Part 5: Effects: the lifecycle discipline" -> "Effects: the lifecycle discipline" */
function shortTitle(title: string): string {
  return title.replace(/^Handbook (\(intro\)|Part \d+|Appendix [A-Z]): ?/, '').replace(/^Appendix [A-Z]: /, '')
}

function buildDocsRouter(): string {
  const lines = [
    'Cordis reference docs and verified working examples live in this workspace. Read them',
    'with your file tools BEFORE implementing a plugin; do not guess from memory of a',
    'similar plugin.',
    '- Docs index: docs/README.md   (manifest: docs/docs.json)',
    '- Examples index: examples/README.md   (every example is verified to do what its header says)',
    '- Always read docs/this-sandbox.md first: it lists what does NOT apply here (cordis.yml, bundles,',
    '  profiles) and the exact plugin file shape mount_plugin accepts (named exports; no default export).',
    '- When asked about a topic, read its doc and the nearest example, and follow `see docs/...`',
    '  cross-references before implementing. Read a doc completely, not just its first lines.',
    '- Topic -> doc (skip anything marked acryl-only):',
  ]
  for (const group of manifest.navigation) {
    for (const item of group.items) {
      if (item.sandbox === 'acryl-only') continue
      lines.push(`  - ${shortTitle(item.title)}: docs/${item.path}`)
    }
  }
  lines.push(
    '- Examples by pattern: function plugin, service provide/inject (PENDING -> ACTIVE), optional',
    '  dependency, effects, events + waterfall, config schema, tools, three-role capability, FAILED and',
    '  PENDING diagnostics, and a complete coding agent: examples/plugins/*.mjs, examples/coding-agent/.',
  )
  return lines.join('\n')
}

// Stable for the process lifetime: part of the cacheable prompt prefix.
const DOCS_ROUTER = buildDocsRouter()

const RULES = [
  'Loop: write_file/edit_file a plugin, mount_plugin it, read the returned real Fiber state.',
  'ACTIVE = worked. PENDING = an unmet inject (healthy, not broken). FAILED = apply() threw: fix the real error.',
  'Never claim a plugin works, or state its live Fiber state or inject list, from memory. Verify with',
  "mount_plugin's result or cordis_inspect_list -> cordis_inspect_query (see docs/verifying-your-work.md).",
  'Keep prose short: the person is watching every step live on a canvas that shows each plugin as a node',
  'and its real state. Narrate briefly, then act.',
].join('\n')

export interface SystemPromptSections {
  preamble: string
  tools: string
  rules: string
  docs: string
  workspace: string
}

export function buildSystemPromptSections(workspaceSummary: string, tools: ToolDefinition[]): SystemPromptSections {
  const toolList = tools.map((t) => `  - ${t.name}: ${t.description.split('\n')[0]}`).join('\n')
  return {
    preamble: [
      'You are a coding agent practicing how to build Cordis plugins, running inside a live',
      'visualizer connected to a REAL @deepseek-ai/cordis Context. Everything you do is real:',
      'files you write land on disk, and mount_plugin activates them in an actual Context - not a',
      'simulation. You work only inside a sandboxed workspace directory (relative paths only).',
    ].join('\n'),
    tools: `Your tools:\n${toolList}`,
    rules: RULES,
    docs: DOCS_ROUTER,
    workspace: `Workspace right now:\n${workspaceSummary}`,
  }
}

export function buildSystemPrompt(workspaceSummary: string, tools: ToolDefinition[]): string {
  const sections = buildSystemPromptSections(workspaceSummary, tools)
  // Preamble stays bare; every other section is tagged (pi does the same) so the
  // model can address them and stable sections form a cacheable prefix.
  return [
    sections.preamble,
    `<tools>\n${sections.tools}\n</tools>`,
    `<rules>\n${sections.rules}\n</rules>`,
    `<docs>\n${sections.docs}\n</docs>`,
    `<workspace>\n${sections.workspace}\n</workspace>`,
  ].join('\n\n')
}

/**
 * Lists only top-level entries plus the docs/examples directories collapsed to
 * one line each: the managed reference trees would otherwise flood every turn
 * with ~70 lines the router already points at.
 */
export function buildWorkspaceSummary(files: string[]): string {
  if (files.length === 0) return '(empty - no files yet)'
  const collapsed = new Set(['docs/', 'examples/'])
  const shown: string[] = []
  for (const f of files) {
    const top = f.split('/')[0] + '/'
    if (collapsed.has(top)) {
      if (f === top) shown.push(`${top}  (reference: see docs index / examples index above)`)
      continue
    }
    shown.push(f)
  }
  const cut = shown.slice(0, 40)
  const more = shown.length > cut.length ? `\n... and ${shown.length - cut.length} more` : ''
  return cut.join('\n') + more
}
