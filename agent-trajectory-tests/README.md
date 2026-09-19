# Agent trajectory tests

Golden-trajectory testing for this tutorial's own suggestion chips: feed a
real, fixed prompt chain to a real, running agent (a real DeepSeek/Qwen/etc.
API key, over this repo's own tutorial server), record the full trajectory,
score it against a defined verifiable goal, and compare the result against
the previous run of the same chain - so the chips themselves can be
iterated on and their real effect measured, not guessed at.

## Why this exists

Every chapter's suggestion chips (`shared/chapter-suggestions.ts`) are a
fixed prompt chain a user clicks through, one chip at a time, waiting for
the agent to finish before the next. That chain is meant to reliably drive
the connected agent to build something real - a mounted plugin reaching
`ACTIVE`, a real tool call, a real file written into `workspace/`. Whether a
given wording of a chip actually gets a real model there reliably is an
empirical question, not something to eyeball once and assume forever. This
harness answers it the same way a coding-agent team answers "did this
prompt change help or hurt": run the identical chain against a real model,
record everything, score it against ground truth, and diff against the
last run.

This is deliberately the **custom-harness** pattern (a thin runner on top of
the real WebSocket protocol, not a hosted eval platform like LangSmith/
Braintrust/Promptfoo) - the same shape most coding-agent teams actually use,
because the "prompt chain -> real running turn -> real tool/file state"
loop here is specific to this repo's own protocol, not a generic chat
completion to score.

**Scope beyond this repo**: Volume 2's chains are a minimal, real rehearsal
of ACRYL's own self-building capability - an agent directed to build its
own Cordis plugins for its own environment. This harness is the same shape
a real ACRYL self-extension eval would take: fixed prompt chain -> real
agent turn -> verifiable goal against real state -> compare across runs to
improve the guiderails/skills that direct that self-building.

## Terminology

- **Prompt chain**: the exact, ordered list of chip prompts for one
  chapter, produced by `promptChainFor(chapterId)` in
  `shared/chapter-suggestions.ts` - the single source of truth also used by
  the real UI's suggestion chips, so a test replays exactly what a user
  would click, never a hand-copied approximation.
- **Trajectory**: the full, ordered recording of every real `TraceEvent`
  produced while feeding one chain - every fiber state change, tool call,
  file write, and turn boundary - not just the final message.
- **Verifiable goal**: a `Goal` (`src/goals.ts`) that inspects the real
  trajectory and the real final workspace state (never the agent's own
  closing prose) and returns pass/fail plus a reason. See `volume-1/cases.ts`
  and `volume-2/cases.ts` for what each chapter's chain is actually checked
  against - e.g. "an agent-written plugin's fiber reaches ACTIVE", "a real
  `config_error` (ValidationError) is observed", "agentLoop's fiber flips
  from PENDING to ACTIVE once `llm.mjs` is mounted".
- **Run**: one full execution of a volume's chain(s) against one real
  model/provider, saved as one new, timestamped folder under
  `volume-<N>/results/` - every run kept, never overwritten, so runs are
  comparable over time as chips get edited.
- **Comparison**: `src/compare.ts` finds the most recent previous run
  folder for the volume (by each folder's own `summary.json` `runAt` ISO
  timestamp - never by the folder name, which is display-friendly, not
  sortable) and reports, per chapter, `improved` / `regressed` /
  `unchanged` / `new` / `missing-now`, based on goal pass/fail plus total
  token cost.

## Layout

```text
agent-trajectory-tests/
  src/
    types.ts       Goal/TestCase/TrajectoryRun/VolumeRunSummary/ChapterComparison shapes
    run-folder.ts  the result-of-run-<DD-MM-YY-HH-MMAM>-<runId> folder-naming convention + generateRunId()
    ws-client.ts   drives the real WebSocket protocol (configure/run_chapter/run)
    goals.ts       reusable verifiable-goal building blocks
    runner.ts      feeds a chain (or a whole volume), records it, scores it, persists it
    compare.ts     diffs a run's summary.json against the volume's previous run
    cli.ts         entrypoint
  scripts/
    load-deepseek-key.sh   loads a real DeepSeek key without ever echoing it
    run-volume-1.sh        full Volume 1 run (Parts 1-4, chapters 01-15)
    run-volume-2.sh         full Volume 2 run (Parts 5-6, chapters 16-24)
  volume-1/
    cases.ts       one TestCase per chapter 01-15
    results/
      result-of-run-<DD-MM-YY-HH-MMAM>-<runId>/
        summary.json          one row per chapter: goal, tokens, steps, wall time
        trajectory/<chapter>.json   full StepRecord[] per chapter - every event,
                                    every prompt, the entire real conversation
        workspace/             a materialized copy of the real workspace's text
                                files at the end of the run - node_modules
                                excluded; `pnpm install` inside it to actually
                                run this exact result again
  volume-2/
    cases.ts       one TestCase per chapter 16-24
    results/       same result-of-run-.../ shape as volume-1
```

## Running it

1. Start the tutorial server (`pnpm dev` from the repo root, or
   `pnpm dev:daemon` to run it in the background) - this harness drives the
   real server over its real WebSocket, it does not embed or fake one.
2. Get a real DeepSeek key into `CORDIS_TRAJECTORY_API_KEY` without ever
   typing or echoing it - `scripts/load-deepseek-key.sh` does this for you
   (project-local `.env.deepseek.json` override first, else
   `~/.secure-storage/llmproviders/deepseek/deepseek.json`), or set it
   yourself for another provider:

   ```bash
   export CORDIS_TRAJECTORY_API_KEY=sk-...
   ```

3. Run a whole volume (the common case - one continuous session, one
   result folder, default model `deepseek-flash`):

   ```bash
   scripts/run-volume-1.sh
   scripts/run-volume-2.sh
   ```

   Or drive `cli.ts` directly for another provider/model, or a single
   chapter:

   ```bash
   pnpm --filter @cordis-tutorial/agent-trajectory-tests run -- \
     --volume 2 --chapter 17-the-loop --provider deepseek --model deepseek-flash
   ```

   Flags: `--volume <1|2>`, `--chapter <id>` (optional filter),
   `--provider`, `--model` (required; any `ProviderId` from
   `shared/index.ts`'s `PROVIDERS` - default `deepseek-flash`, not the more
   expensive `deepseek-v4-pro`), `--base-url` (optional), `--server`
   (defaults to `ws://localhost:8788/ws`), `--timeout-ms` (per-turn
   timeout, defaults to 120000), `--reset-workspace` (wipe the shared
   workspace back to its seeded starter state before this run - use this
   when comparing two models/providers, so the second run can't find files
   the first one already wrote and skip building them itself).

Each run prints goal pass/fail with the real reason, token cost, and wall
time per chapter, then the verdict versus the previous run of that volume,
then writes everything - every chapter's full trajectory and a
node_modules-free copy of the resulting workspace - into one new
`results/result-of-run-.../` folder.

To actually run a saved workspace result standalone:

```bash
cd volume-2/results/result-of-run-.../workspace
pnpm install
pnpm dev
```

## Caveats

Every run gets a short, unique **run id** (`generateRunId()` in
`run-folder.ts` - 4 random bytes as hex, e.g. `a1b2c3d4`), printed in the
CLI output, appended to its result folder's name, and stored as
`summary.json`'s `runId` field - the one thing guaranteed to distinguish two
runs even if their display-friendly timestamps collide.

`workspace/` is shared, real, and persistent across the whole server (same
one the browser UI's agent writes into) - running this harness against a
server someone is also using interactively will write real files into the
same workspace they're looking at, AND running a volume twice in a row (to
compare two models, say) means the second run's agent may find files the
first run already wrote and just verify them instead of building fresh -
not an apples-to-apples comparison. Reset the workspace between comparison
runs (send a `reset_workspace` ClientMessage, or restart the server against
a fresh `CORDIS_TUTORIAL_WORKSPACE` directory) for a fair one. Run against a
dedicated server instance (a different `CORDIS_TUTORIAL_WORKSPACE`/`PORT`)
for a clean, repeatable chain, or expect the chain's own file-write goals
to reflect whatever state
the workspace was already in.
