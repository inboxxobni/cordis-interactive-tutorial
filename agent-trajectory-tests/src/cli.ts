#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChapterId, ProviderId } from "@cordis-tutorial/shared";
import { compareToPreviousVolumeRun } from "./compare.js";
import { formatUsageMetrics } from "./metrics.js";
import { runTestCase, runVolumeSequential, saveVolumeRun } from "./runner.js";
import type { RunConfig, TestCase, TrajectoryRun } from "./types.js";
import { TrajectoryClient } from "./ws-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

/**
 * Runs one or more test cases' prompt chains against a real, running
 * tutorial server and a real LLM API key, then saves ONE timestamped run
 * folder per volume (full trajectories + a materialized workspace copy)
 * and prints a comparison against the previous run of that volume.
 *
 * Usage:
 *   CORDIS_TRAJECTORY_API_KEY=sk-... \
 *     tsx src/cli.ts --volume 1 --provider deepseek --model deepseek-flash
 *   CORDIS_TRAJECTORY_API_KEY=sk-... \
 *     tsx src/cli.ts --volume 2 --chapter 17-the-loop --provider deepseek --model deepseek-flash
 *
 * Flags:
 *   --volume <1|2>        required unless --chapter alone disambiguates it
 *   --chapter <id>        run only this chapter's test case (its own fresh session)
 *   --provider <id>       one of shared's ProviderId (deepseek, openai, anthropic, byteplus, qwen, ollama, lmstudio)
 *   --model <id>
 *   --base-url <url>      optional, defaults to that provider's own default
 *   --server <ws url>     defaults to ws://localhost:8788/ws
 *   --timeout-ms <n>      per-turn timeout, defaults to 120000
 *   --reset-workspace     wipe the shared workspace back to its seeded starter
 *                         state before running - for a fair, from-scratch
 *                         comparison between two models/providers, instead of
 *                         the second run finding files the first one already
 *                         wrote and just verifying them instead of building
 *                         fresh
 *
 * A whole-volume run (no --chapter) feeds every chapter's chain through ONE
 * continuous session - see runVolumeSequential's own comment for why that
 * matters for Volume 2 specifically (agentLoop only ever reaches ACTIVE if
 * chapters 17-22 share one live Context, exactly like a real user never
 * reconnecting mid-volume).
 *
 * The API key itself is never a flag - set CORDIS_TRAJECTORY_API_KEY so it
 * never lands in shell history or a process list.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = args.get("provider") as ProviderId | undefined;
  const model = args.get("model");
  if (!provider || !model) {
    console.error("Usage: tsx src/cli.ts --volume <1|2> [--chapter <id>] --provider <id> --model <id> [--base-url <url>] [--server <ws url>] [--timeout-ms <n>] [--reset-workspace]");
    process.exitCode = 1;
    return;
  }

  const config: RunConfig = {
    provider,
    model,
    baseURL: args.get("base-url"),
    serverUrl: args.get("server") ?? "ws://localhost:8788/ws",
    turnTimeoutMs: Number(args.get("timeout-ms") ?? 120_000),
    resetWorkspaceFirst: args.has("reset-workspace"),
  };

  const chapterFilter = args.get("chapter") as ChapterId | undefined;
  const volumeArg = args.get("volume");

  const targets: Array<{ volume: 1 | 2; dir: string; cases: TestCase[] }> = [];
  if (!volumeArg || volumeArg === "1") {
    const { VOLUME_1_CASES } = await import("../volume-1/cases.js");
    targets.push({ volume: 1, dir: path.join(rootDir, "volume-1"), cases: VOLUME_1_CASES });
  }
  if (!volumeArg || volumeArg === "2") {
    const { VOLUME_2_CASES } = await import("../volume-2/cases.js");
    targets.push({ volume: 2, dir: path.join(rootDir, "volume-2"), cases: VOLUME_2_CASES });
  }

  let anyFailed = false;
  for (const target of targets) {
    const cases = chapterFilter ? target.cases.filter((c) => c.chapter === chapterFilter) : target.cases;
    if (cases.length === 0) continue;

    console.log(`\n### Volume ${target.volume} - ${cases.length} chapter(s)${chapterFilter ? " (own fresh session)" : ", one continuous session"} ###`);
    if (config.resetWorkspaceFirst) console.log("  (resetting workspace to its seeded starter state first)");

    const runs: TrajectoryRun[] =
      cases.length === 1 && chapterFilter
        ? [await runReportingProgress(cases[0]!, config)]
        : await runVolumeSequential(cases, config, async (run) => {
            console.log(`  ${run.chapter}: ${run.goal.passed ? "PASS" : "FAIL"} (${formatUsageMetrics(run.usage)}, ${(run.wallMs / 1000).toFixed(1)}s)`);
          });

    const { files, snapshot } = await fetchFinalWorkspaceSnapshot(config.serverUrl);
    const { dir, summary } = await saveVolumeRun(target.dir, runs, config, files, snapshot);
    const { previous, chapters } = await compareToPreviousVolumeRun(target.dir, summary);

    console.log(`\n--- Volume ${target.volume} results [runId ${summary.runId}] (saved: ${path.relative(rootDir, dir)}) ---`);
    for (const run of runs) {
      console.log(`\n${run.chapter}`);
      console.log(`  goal: ${run.goal.description}`);
      console.log(`  ${run.goal.passed ? "PASS" : "FAIL"} - ${run.goal.details}`);
      console.log(`  wall time: ${(run.wallMs / 1000).toFixed(1)}s, ${formatUsageMetrics(run.usage)}`);
      if (!run.goal.passed) anyFailed = true;
    }
    console.log(`\nVolume ${target.volume} total: ${formatUsageMetrics(summary.totalUsage)}`);

    console.log(`\nvs previous run (${previous ? `runId ${previous.runId}, ${previous.runAt}` : "none"}):`);
    for (const c of chapters) {
      const cacheDelta =
        c.usageBefore?.cacheHitRate !== undefined && c.usageNow.cacheHitRate !== undefined
          ? `, cache hit ${(c.usageBefore.cacheHitRate * 100).toFixed(1)}% -> ${(c.usageNow.cacheHitRate * 100).toFixed(1)}%`
          : "";
      console.log(`  ${c.chapter}: ${c.verdict}${c.tokensBefore !== null ? ` (tokens ${c.tokensBefore} -> ${c.tokensNow}${cacheDelta})` : ""}`);
    }
    if (previous) {
      console.log(`  TOTAL: ${formatUsageMetrics(previous.totalUsage)} -> ${formatUsageMetrics(summary.totalUsage)}`);
    }
  }

  process.exitCode = anyFailed ? 1 : 0;
}

async function runReportingProgress(testCase: TestCase, config: RunConfig): Promise<TrajectoryRun> {
  const run = await runTestCase(testCase, config);
  console.log(`  ${run.chapter}: ${run.goal.passed ? "PASS" : "FAIL"} (${formatUsageMetrics(run.usage)}, ${(run.wallMs / 1000).toFixed(1)}s)`);
  return run;
}

/** One short-lived connection just to read the real, final, shared workspace state after the whole chain (or volume) has finished. */
async function fetchFinalWorkspaceSnapshot(serverUrl: string): Promise<{ files: string[]; snapshot: Record<string, string> }> {
  const client = new TrajectoryClient(serverUrl);
  await client.connect();
  try {
    return await client.workspaceSnapshot(serverUrl.replace(/^ws/, "http").replace(/\/ws$/, ""));
  } finally {
    client.close();
  }
}

function parseArgs(argv: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        map.set(key, value);
        i++;
      } else {
        map.set(key, "true");
      }
    }
  }
  return map;
}

void main();
