#!/usr/bin/env node
/**
 * Builds server/agent-context/docs/ - the reference docs the tutorial agent
 * reads on demand (pi.dev pattern: a manifest + topic-sized files, not one
 * giant prompt). The ACRYL repo's own docs stay the source of truth; this
 * splits the long handbook by Part so the agent loads one topic, not 105 KB,
 * and writes docs.json (the manifest the system-prompt router is generated
 * from). Re-run to resync:
 *
 *   ACRYL_DOCS_DIR=/path/to/acryl/docs node server/scripts/sync-agent-docs.mjs
 *
 * Hand-written docs (this-sandbox.md, etc.) live in agent-context/docs/ too
 * and are NOT touched here; only guide/, cheatsheet.md and acryl/ are
 * generated.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outRoot = path.resolve(here, '../agent-context/docs')
const acrylDocs = process.env.ACRYL_DOCS_DIR || '/Users/musichen/_projects/p11_acr_agentcontextrelay/acryldev/acryl/docs'
const GUIDE_SRC = path.join(acrylDocs, 'cordis/cordis_system_guide_for_coding_agents.md')

// sandbox: does this topic apply to the tutorial sandbox (mount_plugin + ctx),
// only partly, or only to real ACRYL/DSH Desktop composition (cordis.yml,
// bundles, profiles)?
const PARTS = {
  0: ['purpose', 'Purpose of the handbook', 'applies', 'Orientation only.'],
  1: ['mental-model', 'The Cordis mental model', 'applies', 'Before writing your first plugin or when Cordis terms (Context, Fiber, Service, effect) are unclear.'],
  2: ['theory', 'Theory translated into engineering', 'partial', 'Only when you need the WHY behind effects/disposers/LIFO cleanup. Skip for routine plugin work.'],
  3: ['runtime', 'The actual Cordis runtime (Context API)', 'applies', 'Using ctx.extend/isolate/intercept, or unsure what ctx really exposes.'],
  4: ['plugins-and-fibers', 'Plugins and Fibers', 'applies', 'Choosing a plugin shape (function/object/class), ctx.plugin(), Fiber states (PENDING is not an error), Registry.'],
  5: ['effects', 'Effects: the lifecycle discipline', 'applies', 'Any timer, subscription, listener, or resource that outlives one apply() call.'],
  6: ['services-and-inject', 'Services and live dependency injection', 'applies', 'ctx.provide / inject, required vs optional deps, provider replacement, three-role capability seams.'],
  7: ['events', 'Events', 'applies', 'ctx.emit / on and the dispatch modes (parallel, serial, bail, waterfall), typed events.'],
  8: ['configuration', 'Plugin configuration', 'applies', 'Config schemas (Schemastery), validation failure, config update/HMR.'],
  9: ['loader-and-hmr', 'cordis.yml, Loader, reconciliation, HMR', 'acryl-only', 'Only for real ACRYL/DSH composition via cordis.yml. Not used by mount_plugin.'],
  10: ['harness-runtime', 'DeepSeek Harness: Cordis as an agent runtime', 'partial', 'Understanding how Harness layers agent services on Cordis.'],
  11: ['tools', 'Tools: from plugin to model-callable capability', 'applies', 'Writing a tool plugin (defineTool shape: name, parameters, output, execute) against a tools service.'],
  12: ['llm-adapters', 'LLM adapters', 'partial', 'Implementing an llm service / provider adapter (stream/StreamChunk contract).'],
  13: ['hands-on-mini-system', 'End-to-end hands-on Cordis mini-system', 'applies', 'A worked, multi-plugin build from scratch. Read before building anything multi-file.'],
  14: ['three-role-capability', 'Three-role capability design', 'applies', 'Splitting a capability into Service Definition / Provider / Consumer.'],
  15: ['profiles-bundles-publishing', 'Profiles, bundles, patches, publishing', 'acryl-only', 'Only when packaging a plugin for a real ACRYL/DSH install.'],
  16: ['decision-framework', 'Coding-agent decision framework', 'applies', 'Deciding what kind of thing to build (plugin vs service vs event vs tool).'],
  17: ['debugging', 'Debugging', 'applies', 'A plugin is PENDING, FAILED, silent, or duplicating after re-mount.'],
  18: ['anti-patterns', 'Anti-pattern catalog', 'applies', 'Review your plugin against known mistakes before declaring it done.'],
  19: ['self-updatable-systems', 'Designing self-updatable systems', 'applies', 'An agent building/replacing its own plugins (ACRYL self-extension).'],
  20: ['testing', 'Testing Cordis components', 'applies', 'Verifying a plugin for real: mount it, read real fiber state.'],
  21: ['what-should-i-use', 'Practical reference: what should I use?', 'applies', 'Quick lookup: capability -> Cordis primitive.'],
  22: ['rules', 'Coding-agent rules: MUST / SHOULD / MUST NOT', 'applies', 'Read once before writing plugin code; the non-negotiables.'],
  23: ['architecture-review', 'Architecture review template', 'partial', 'Reviewing a multi-plugin design.'],
  24: ['acryl-platform', 'Applying the model to an ACRYL-style platform', 'acryl-only', 'ACRYL-specific architecture; not needed for sandbox plugins.'],
  25: ['source-reading', 'Source-reading guide', 'partial', 'When docs are ambiguous and you must read the real @deepseek-ai/cordis source.'],
  26: ['compact-reference', 'Compact master reference', 'applies', 'A one-page recap once you know the model.'],
  27: ['operating-principles', 'Final operating principles', 'applies', 'The short principles list.'],
  28: ['appendix-a-source-map', 'Appendix A: practical source map', 'partial', 'Where things live in the real source.'],
  29: ['appendix-b-completion-checklist', 'Appendix B: completion checklist', 'applies', 'Run this checklist before claiming a plugin is done.'],
  30: ['appendix-c-onboarding-prompt', 'Appendix C: 30-second onboarding prompt', 'applies', 'Fastest orientation.'],
}

function partNumber(headingLine, seen) {
  if (/^# Part /.test(headingLine)) {
    const roman = headingLine.match(/^# Part ([IVXL]+)/)?.[1]
    const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25, XXVI: 26, XXVII: 27 }
    return map[roman]
  }
  if (/^# Appendix A/.test(headingLine)) return 28
  if (/^# Appendix B/.test(headingLine)) return 29
  if (/^# Appendix C/.test(headingLine)) return 30
  return null
}

const pad = (n) => String(n).padStart(2, '0')
const guideDir = path.join(outRoot, 'guide')
await fs.mkdir(guideDir, { recursive: true })

const lines = (await fs.readFile(GUIDE_SRC, 'utf8')).split('\n')
const boundaries = [{ n: 0, start: 0 }]
lines.forEach((l, i) => {
  const n = partNumber(l)
  if (n) boundaries.push({ n, start: i })
})

const guideEntries = []
for (let b = 0; b < boundaries.length; b++) {
  const { n, start } = boundaries[b]
  const end = b + 1 < boundaries.length ? boundaries[b + 1].start : lines.length
  const [slug, title, sandbox, when] = PARTS[n]
  const file = `part-${pad(n)}-${slug}.md`
  const body = lines.slice(start, end).join('\n').trimEnd()
  const header = `<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines ${start + 1}-${end} by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: ${sandbox}. -->\n\n`
  await fs.writeFile(path.join(guideDir, file), header + body + '\n', 'utf8')
  guideEntries.push({ title: n === 0 ? `Handbook (intro): ${title}` : n <= 27 ? `Handbook Part ${n}: ${title}` : `Handbook ${title}`, path: `guide/${file}`, sandbox, when })
}

// Verbatim single-file copies.
const copies = [
  ['cordis/cordis-usage-cheatsheet.md', 'cheatsheet.md'],
  ['cordisplugins/hello-world-plugin-guide.md', 'acryl/hello-world-plugin-guide.md'],
  ['cordisplugins/README.md', 'acryl/README.md'],
]
for (const [from, to] of copies) {
  const dest = path.join(outRoot, to)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const src = await fs.readFile(path.join(acrylDocs, from), 'utf8')
  await fs.writeFile(dest, `<!-- Synced verbatim from acryl docs/${from} by server/scripts/sync-agent-docs.mjs. Do not edit here. -->\n\n${src}`, 'utf8')
}

// docs.json: navigation manifest (same idea as pi's docs/docs.json). The
// system-prompt router in server/src/system-prompt.ts is generated from this,
// so adding a doc here is the ONLY step needed to make the agent aware of it.
const manifest = {
  navigation: [
    {
      title: 'Start here',
      items: [
        { title: 'This sandbox vs real ACRYL/DSH', path: 'this-sandbox.md', sandbox: 'applies', when: 'Always read first: what tools you have, what plugin file shapes work, what does not apply here.' },
        { title: 'Cordis usage cheatsheet (source-validated)', path: 'cheatsheet.md', sandbox: 'applies', when: 'Fast one-page contract for Context, Service, inject, events, Fiber, effects. Includes doc-vs-source corrections.' },
        { title: 'Verifying your work', path: 'verifying-your-work.md', sandbox: 'applies', when: 'Before claiming a plugin works or stating any live Fiber state.' },
        { title: 'Building the coding-agent harness', path: 'coding-agent-harness.md', sandbox: 'applies', when: 'Building tools/llm/contextWindow/compaction/systemPrompt/agentLoop plugins.' },
      ],
    },
    { title: 'Handbook (Cordis System Guide for Coding Agents, split by Part)', items: guideEntries },
    {
      title: 'ACRYL Desktop only (not used by mount_plugin)',
      items: [
        { title: 'Hello World plugin guide (bundles, profiles)', path: 'acryl/hello-world-plugin-guide.md', sandbox: 'acryl-only', when: 'Only when packaging/installing a plugin into real ACRYL Desktop.' },
        { title: 'Cordis plugins index', path: 'acryl/README.md', sandbox: 'acryl-only', when: 'Index of the ACRYL-side plugin docs.' },
      ],
    },
  ],
}
await fs.writeFile(path.join(outRoot, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
// docs/README.md: human/agent-readable index generated from the manifest
// (pi's docs/index.md equivalent), so it can never disagree with docs.json.
const indexLines = [
  '# Cordis architecture docs',
  '',
  '<!-- Generated from docs.json by server/scripts/sync-agent-docs.mjs. Do not edit here. -->',
  '',
  'Read the file for your topic BEFORE implementing. Read it completely and follow',
  'its cross-references (`see docs/...`) and the example files it names. Do not',
  'guess from memory of a similar plugin. Working examples: `examples/README.md`.',
  '',
]
for (const group of manifest.navigation) {
  indexLines.push(`## ${group.title}`, '', '| Doc | Read it when | Applies here |', '|---|---|---|')
  for (const item of group.items) indexLines.push(`| [${item.title}](${item.path}) | ${item.when} | ${item.sandbox} |`)
  indexLines.push('')
}
await fs.writeFile(path.join(outRoot, 'README.md'), indexLines.join('\n'), 'utf8')
await fs.rm(path.join(outRoot, 'guide-entries.generated.json'), { force: true })
console.log(`wrote ${guideEntries.length} guide parts + ${copies.length} copied docs + docs.json to ${outRoot}`)
