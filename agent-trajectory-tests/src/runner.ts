import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TraceEvent } from "@cordis-tutorial/shared";
import { computeUsageMetrics, sumUsageMetrics } from "./metrics.js";
import { formatRunFolderName, generateRunId } from "./run-folder.js";
import { TrajectoryClient } from "./ws-client.js";
import type { ChapterSummary, RunConfig, StepRecord, TestCase, TrajectoryRun, VolumeRunSummary } from "./types.js";

function turnEndTotalTokens(events: TraceEvent[]): number {
  const last = [...events].reverse().find((e): e is Extract<TraceEvent, { type: "turn_end" }> => e.type === "turn_end");
  return last?.totalTokens ?? 0;
}

function requireApiKey(): string {
  const key = process.env.CORDIS_TRAJECTORY_API_KEY;
  if (!key) throw new Error("Set CORDIS_TRAJECTORY_API_KEY (the real provider key to test the chain with) - never pass a key on the command line.");
  return key;
}

function httpBaseUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/ws$/, "");
}

async function runOneChain(
  client: TrajectoryClient,
  testCase: TestCase,
  config: RunConfig,
): Promise<{ steps: StepRecord[]; wallMs: number }> {
  const wallStart = Date.now();
  client.runChapter(testCase.chapter);
  const steps: StepRecord[] = [];
  for (const prompt of testCase.chain) {
    const startedAt = new Date().toISOString();
    const { status, events } = await client.runTurn(prompt, config.turnTimeoutMs);
    steps.push({ prompt, startedAt, endedAt: new Date().toISOString(), status, events });
    if (status !== "done") break; // a broken/timed-out step invalidates the rest of the chain
  }
  return { steps, wallMs: Date.now() - wallStart };
}

function buildRun(testCase: TestCase, config: RunConfig, steps: StepRecord[], wallMs: number, files: string[], snapshot: Record<string, string>): TrajectoryRun {
  const allEvents = steps.flatMap((s) => s.events);
  const goalResult = testCase.goal.check({ events: allEvents, files, snapshot });
  return {
    chapter: testCase.chapter,
    runAt: new Date().toISOString(),
    config: { provider: config.provider, model: config.model, baseURL: config.baseURL, serverUrl: config.serverUrl, turnTimeoutMs: config.turnTimeoutMs, resetWorkspaceFirst: config.resetWorkspaceFirst },
    steps,
    goal: { description: testCase.goal.description, passed: goalResult.passed, details: goalResult.details },
    finalFiles: files,
    totalTokens: steps.reduce((sum, s) => sum + turnEndTotalTokens(s.events), 0),
    totalSteps: steps.reduce((sum, s) => sum + (s.events.filter((e) => e.type === "loop_start").length || 0), 0),
    wallMs,
    usage: computeUsageMetrics(allEvents),
  };
}

/**
 * Feeds ONE test case's prompt chain in its own fresh session (a new
 * WebSocket connection, so a brand-new, empty Cordis Context) - the right
 * shape for testing a single chapter in isolation, e.g. `--chapter 09-...`.
 * Not what a whole-volume run should use: see runVolumeSequential below for
 * why.
 */
export async function runTestCase(testCase: TestCase, config: RunConfig): Promise<TrajectoryRun> {
  const client = new TrajectoryClient(config.serverUrl);
  await client.connect();
  try {
    if (config.resetWorkspaceFirst) await client.resetWorkspace();
    client.configure(config.provider, config.model, requireApiKey(), config.baseURL);
    const { steps, wallMs } = await runOneChain(client, testCase, config);
    const { files, snapshot } = await client.workspaceSnapshot(httpBaseUrl(config.serverUrl));
    return buildRun(testCase, config, steps, wallMs, files, snapshot);
  } finally {
    client.close();
  }
}

/**
 * Feeds every test case's chain through ONE continuous session (one
 * WebSocket connection, one live Cordis Context) - matching how a real
 * user actually moves through a volume in the UI: they never reconnect
 * between chapters, so a plugin mounted in chapter 17 is still mounted
 * (and still real-mindedly PENDING) when chapter 22 finally satisfies its
 * last dependency and flips it to ACTIVE. Reconnecting per chapter would
 * hand each chapter a brand-new, empty Context - agentLoop would never be
 * able to reach ACTIVE at all, because nothing from 17-21 would still be
 * mounted by the time 22 runs. Each chapter's goal is still scored only
 * against that chapter's OWN chain events (not the whole volume's), same
 * as a per-chapter run - only the underlying Context and workspace persist.
 */
export async function runVolumeSequential(
  cases: TestCase[],
  config: RunConfig,
  onRunComplete?: (run: TrajectoryRun) => Promise<void>,
): Promise<TrajectoryRun[]> {
  const client = new TrajectoryClient(config.serverUrl);
  await client.connect();
  const runs: TrajectoryRun[] = [];
  try {
    if (config.resetWorkspaceFirst) await client.resetWorkspace();
    client.configure(config.provider, config.model, requireApiKey(), config.baseURL);
    for (const testCase of cases) {
      const { steps, wallMs } = await runOneChain(client, testCase, config);
      const { files, snapshot } = await client.workspaceSnapshot(httpBaseUrl(config.serverUrl));
      const run = buildRun(testCase, config, steps, wallMs, files, snapshot);
      runs.push(run);
      if (onRunComplete) await onRunComplete(run);
      // A step that never reached `done` (error/timeout) leaves the Context
      // and workspace in a state later chapters weren't written to expect -
      // stop the sequential chain here rather than compounding the failure.
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.status !== "done") break;
    }
    return runs;
  } finally {
    client.close();
  }
}

/**
 * Persists one full run - every chapter's complete trajectory (every event,
 * every prompt, the entire real conversation the agent had, verbose
 * reasoning included) plus a materialized copy of the real workspace's text
 * files at the end of the run (node_modules excluded - `pnpm install` gets
 * a runnable copy back) - as one new, timestamped folder under
 * `<volumeDir>/results/`. Every run gets its own folder, never overwritten,
 * so runs are comparable over time as chips get edited.
 *
 * `workspaceFiles`/`workspaceSnapshot` should be a single fetch taken AFTER
 * the whole chain (or whole volume) finished - the final state, not a
 * per-chapter interim one; each entry's full text is what's saved.
 */
export async function saveVolumeRun(
  volumeDir: string,
  runs: TrajectoryRun[],
  config: RunConfig,
  workspaceFiles: string[],
  workspaceSnapshot: Record<string, string>,
): Promise<{ dir: string; summary: VolumeRunSummary }> {
  const runId = generateRunId();
  const runFolder = formatRunFolderName(new Date(), runId);
  const dir = path.join(volumeDir, "results", runFolder);

  const trajectoryDir = path.join(dir, "trajectory");
  await mkdir(trajectoryDir, { recursive: true });
  for (const run of runs) {
    await writeFile(path.join(trajectoryDir, `${run.chapter}.json`), JSON.stringify(run, null, 2), "utf8");
  }

  const workspaceDir = path.join(dir, "workspace");
  await mkdir(workspaceDir, { recursive: true });
  for (const rel of workspaceFiles) {
    if (rel.endsWith("/")) {
      await mkdir(path.join(workspaceDir, rel), { recursive: true });
      continue;
    }
    const content = workspaceSnapshot[rel];
    if (content === undefined) continue; // binary or over the 500KB snapshot cap - not saved, still listed in summary.json's finalFiles per-chapter record
    const target = path.join(workspaceDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  const chapters: ChapterSummary[] = runs.map((run) => ({
    chapter: run.chapter,
    goalDescription: run.goal.description,
    goalPassed: run.goal.passed,
    goalDetails: run.goal.details,
    tokens: run.totalTokens,
    steps: run.totalSteps,
    wallMs: run.wallMs,
    usage: run.usage,
  }));

  const summary: VolumeRunSummary = {
    runId,
    runFolder,
    runAt: new Date().toISOString(),
    provider: config.provider,
    model: config.model,
    baseURL: config.baseURL,
    chapters,
    totalUsage: sumUsageMetrics(chapters.map((c) => c.usage)),
  };
  await writeFile(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  return { dir, summary };
}
