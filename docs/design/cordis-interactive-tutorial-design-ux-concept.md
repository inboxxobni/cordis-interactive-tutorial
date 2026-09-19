# Design brief: Cordis Interactive Tutorial — UX redesign concept

This is a prompt for a design agent tasked with producing a new, more
ergonomic, intuitive UX mockup for this project. It captures the product's
core idea, everything it currently does, how it's currently laid out, and
the real usability problems already found while building it - so the
redesign fixes root causes instead of re-discovering (or re-introducing)
the same issues. Read `README.md` alongside this for the plain functional
description; this document is about *experience*, not feature listing.

---

## 1. The core idea (get this right first - it drives every layout decision)

This is **not a documentation site with code samples**. It is a real,
live, instrumented [Cordis](https://github.com/deepseek-ai/deepseek-harness)
plugin-framework `Context`, running on a real server, mounting real plugin
files. Nothing shown on screen is narrated or simulated:

- The "plugin canvas" reflects the actual in-memory state of a real
  `@deepseek-ai/cordis` `Context` object - Fiber states, service
  registrations, event dispatches - captured by hooking Cordis's own
  internal instrumentation points.
- A real DeepSeek-backed (or OpenAI/Anthropic/Byteplus/Qwen/Ollama/LM
  Studio-backed) coding agent writes real `.mjs` plugin files to a real
  directory on disk and mounts them into that same live Context via
  `mount_plugin` - the exact `ctx.plugin()` call a real Loader makes.
- The workspace directory is a real, standalone, portable Node project
  (its own `package.json`, a `run.mjs` bootstrap using the real DSH
  `dsh-host-webserver`) - copy it anywhere, `pnpm install && pnpm dev`,
  and it runs completely independent of this tutorial's own server.
- There is a real terminal (`xterm.js` + `node-pty`) `cwd`'d at that same
  real directory, and a real Monaco code editor that saves real edits back
  to real files on disk.

**The design mandate that follows from this**: the UI's #1 job is making
the *realness* legible at a glance - a learner should never wonder "is
this actually happening or is this a canned demo?" The current build
answers that question correctly (everything genuinely is real) but the
*visual language* doesn't yet make that obvious enough - "live" panels
look no different from "static" ones.

## 2. Who uses this, and in what mental mode

Two audiences, often the same person at different moments:

1. **Learner mode** - working through the guided chapter curriculum (15
   chapters: 7 core Cordis primitives, 6 ACRYL/Harness-specific
   conventions, 2 practice/reference chapters) to build a mental model of
   Cordis one primitive at a time (plugin → lifecycle/effects → services →
   events → config → composition/HMR → harness tools → ACRYL
   conventions).
2. **Builder mode** - using the same live Context via a real coding agent
   (or hand-editing files directly in the terminal/editor) to actually
   build and mount a real plugin, rehearsing the exact workflow ACRYL's own
   agent needs for self-building.

These are not two separate products - the same plugin canvas, workspace,
and trace log serve both - but they are two different *jobs to be done*,
and the current layout doesn't visually distinguish "I'm here to learn"
from "I'm here to build," even though the sidebar chapter list and the
agent console sit right next to each other implying they're peers, not
sequential phases of the same session.

## 3. Everything currently in the product (functional inventory)

**Left rail** - a global chapter navigator (always visible, not a hidden
menu - that was an explicit, sharp correction after an earlier hidden-modal
version was called out as undiscoverable). Grouped by Part (Cordis Core /
ACRYL Harness Basics / ACRYL's Built-in Services / Practice), each chapter
a number + short description; four chapters marked `REF` (reference-only,
not runnable - they document real conventions that need infrastructure
this sandbox doesn't pull in).

**Agent console** - provider/model status, a chat-style panel with
numbered "try one of these" suggestion chips (three that build on each
other sequentially, one independent), a text input, and a live streaming
transcript of the agent's turns (assistant text, tool calls, tool
results).

**Plugin canvas** - the live view: nodes appear/move/pulse as real
`fiber_state_change` events arrive (PENDING → LOADING → ACTIVE, or FAILED),
colored by state, showing plugin name, source file, and unmet injects.

**Theory + Source panels** (shown once a chapter is active) - hand-written
explanatory prose with inline term tooltips, and the chapter's own real
server-side source file fetched live and shown with syntax highlighting.

**Live trace log** - a scrolling, monospace feed of every real WebSocket
event as it arrives (`plugin_register`, `fiber_state_change`,
`service_provide`, tool calls, etc.) - the "raw truth" feed underlying
everything else.

**Workspace panel** - a real file tree (tabs: files / diff) of the actual
directory on disk; clicking a file opens a large modal overlay containing
a full Monaco editor (real syntax highlighting, edit-and-save, and
"explain selection" - highlight any code span and ask the agent about
exactly that text).

**Terminal panel** - a real `xterm.js` terminal wired to a real shell,
`cwd`'d at the same workspace directory - `ls`, `pnpm install`,
`node run.mjs` all genuinely execute.

**History / Replay panel** - every live event is recorded automatically
(no manual "save" step) into a session list; selecting a past session
enters step-through replay with prev/next/play/pause and a clickable
timeline scrubber.

**Archives & bundles** - "archive current" saves the real workspace files
*and* their paired event history together as one server-side checkpoint;
"export/import bundle" does the same as one portable `.json` file. Both
were deliberately unified after user feedback that splitting files from
history "doesn't make any sense."

**Clear workspace** - a confirm-gated reset back to the seeded starter
files, for starting a fresh teaching session without losing the previous
one (it stays in History).

**Settings** - a modal with one `<details>` section per provider (7 real
providers, real model lists, per-provider saved key/endpoint/model), a
connection test per provider, and a top-bar "active config" chip always
showing exactly what the agent will use next.

## 4. Current layout (what to keep, question, or replace)

A four-column CSS grid, roughly: **chapter nav** (220px) | **agent
console** (280px) | **main column** (canvas, theory, source, trace, flex)
| **workspace + history + archives sidebar** (340px). The file editor and
settings both break out of this grid into large centered overlays (a
direct fix for an earlier version that squeezed Monaco into the 340px
sidebar and made code unreadable - lesson: anything that needs real
reading/editing space must not live in a narrow rail).

Real problems already found in this layout, in the order they were
reported, worth treating as constraints/anti-goals for the redesign
rather than rediscovering:

- **A narrow rail cannot host a code surface.** Monaco crammed into 340px
  truncated lines mid-word. Fixed by promoting it to a full overlay - but
  this suggests the rail-based IA itself may be the wrong shape for
  anything beyond glanceable status; consider whether the *terminal*
  (currently inline in the main column, better, but still cramped at
  phone-ish widths) and even the *workspace file tree* deserve more
  deliberate placement than "whatever's left in the sidebar."
- **Auto-opening overlays are hostile.** A file editor that popped open
  automatically on every connect (because it shared state with a
  DIFFERENT concern - "which file is selected for diffing") drew explicit
  frustration. Any "big modal" must open *only* on unambiguous user
  intent, never as a side effect of unrelated state changing.
- **Silent, unlabeled coupling between features confuses.** Numbered
  suggestion chips that quietly depended on each other's output ("is
  everGything expected to be sequential?"), and an export button that only
  captured half of what "save my work" should mean (history without
  files) both drew genuine confusion, not just polish complaints. The
  redesign should make dependencies and scope-of-an-action legible in the
  UI itself, not just in a tooltip.
- **Undiscoverable navigation is worse than no navigation.** A
  hidden-behind-a-tiny-button chapter menu was called "total shit" for
  good reason - the fix (always-visible left rail) should be treated as a
  hard requirement, not a preference: nothing structurally important
  (chapter list, active provider, workspace path, run state) should ever
  require a click to discover it exists.
- **Process/runtime state (ports, running servers, PIDs) is invisible in
  the UI entirely** and lives only in terminal output the user has to go
  find - worth considering whether "is the backend actually alive right
  now" belongs somewhere in the chrome itself.

## 5. What "more ergonomic, intuitive, and clear for developers" should
   actually mean here

Concretely, the redesign should aim to:

1. **Make "live vs. static" visually unmistakable** - a real-time pulse,
   a distinct treatment for anything backed by an active WebSocket/PTY
   feed vs. static reference text, so "is this real" is answered by
   glancing, not by reading a caption.
2. **Separate Learn and Build into a clear, switchable mode** (or a clear
   visual "you are here" indicator) rather than presenting the chapter
   list and the agent console as equal-weight neighbors when they're
   really sequential phases of one session for most users.
3. **Give code-shaped content (editor, terminal, diff, source) a
   first-class large surface** by default, not a rail that has to be
   promoted to an overlay after the fact - the current overlay pattern is
   an acceptable *fallback* but a redesign should ask whether the resting
   layout can just give these enough room natively (tabs? a
   resizable/collapsible rail-vs-canvas split? a dedicated "workbench"
   mode?).
4. **Make continuity (history, archives, bundles, clear-workspace)
   legible as one coherent story** - "here's what happened, here's what's
   saved, here's how to get back to it, here's how to start fresh" -
   rather than four separately-labeled panels a user has to mentally
   stitch together.
5. **Surface runtime/process health in the chrome**, not just in a
   terminal the user has to think to open.
6. **Preserve the terminal-flavored dark aesthetic** (monospace,
   amber/cyan/green state colors already meaningfully mapped to Fiber
   states) - this is a good, intentional visual identity; the ask is
   information architecture and interaction clarity, not a reskin.

## 6. Deliverable

One or more new layout mockups (wireframe-fidelity is fine; this is an IA
and interaction-model exercise first, visual polish second) that address
section 5's goals concretely, showing: the resting/default state, a
chapter actively running, the agent mid-turn with a file open, and a
replay-in-progress state. Call out explicitly what changed from the
current four-column-grid-plus-overlays model and why, referencing the
specific problems in section 4 each change resolves.
