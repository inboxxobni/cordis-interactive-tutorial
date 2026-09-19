import type { ChapterId, ProviderId, TraceEvent } from "@cordis-tutorial/shared";

/**
 * A "verifiable goal" for one test case: given everything that happened
 * while feeding its prompt chain (every real TraceEvent, plus the real
 * final workspace file list/contents), decide pass/fail with a human-
 * readable reason. Goals read real server output - fiber states, tool
 * results, file writes - never the agent's own prose claiming success.
 */
export interface GoalContext {
  events: TraceEvent[];
  files: string[];
  snapshot: Record<string, string>;
}

export interface GoalResult {
  passed: boolean;
  details: string;
}

export interface Goal {
  description: string;
  check(ctx: GoalContext): GoalResult;
}

/** One step of a prompt chain: the exact chip text, fed as a `run` message. */
export interface ChainStep {
  prompt: string;
}

export interface TestCase {
  chapter: ChapterId;
  /** The exact prompt chain a user would click through, in order - sourced from shared/chapter-suggestions.ts's promptChainFor(), never hand-copied. */
  chain: string[];
  goal: Goal;
}

/** One fed prompt's real trajectory: the events it produced and how the turn ended. */
export interface StepRecord {
  prompt: string;
  startedAt: string;
  endedAt: string;
  status: "done" | "error" | "timeout";
  events: TraceEvent[];
}

export interface RunConfig {
  provider: ProviderId;
  model: string;
  baseURL?: string;
  serverUrl: string;
  turnTimeoutMs: number;
  /** Wipe the shared workspace back to its seeded starter state before this run - for a fair, from-scratch comparison between two models/providers instead of the second one finding files the first one already wrote. */
  resetWorkspaceFirst: boolean;
}

/**
 * Real token/cache accounting rolled up from every `llm_response` event in
 * a set - the real provider's own reported usage, not an estimate.
 * `cacheHitTokens`/`cacheMissTokens`/`cacheHitRate` are `undefined` (not 0)
 * when nothing in the set reported cache usage at all (some providers
 * don't) - see metrics.ts.
 */
export interface UsageMetrics {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  cacheHitRate?: number;
}

/** One full recorded run of one test case's chain against a real, running agent. */
export interface TrajectoryRun {
  chapter: ChapterId;
  runAt: string;
  config: Omit<RunConfig, "serverUrl"> & { serverUrl: string };
  steps: StepRecord[];
  goal: { description: string; passed: boolean; details: string };
  finalFiles: string[];
  /** Sum of every step's totalTokens, from each step's own turn_end event. */
  totalTokens: number;
  totalSteps: number;
  wallMs: number;
  usage: UsageMetrics;
  /** File paths under docs/ and examples/ the agent read via read_file during this chapter. */
  contextReads: { docs: string[]; examples: string[] };
}

/** Comparison of one chapter's goal/cost against the same chapter in the most recent previous volume run. */
export interface ChapterComparison {
  chapter: ChapterId;
  goalPassedBefore: boolean | null;
  goalPassedNow: boolean;
  tokensBefore: number | null;
  tokensNow: number;
  stepsBefore: number | null;
  stepsNow: number;
  usageBefore: UsageMetrics | null;
  usageNow: UsageMetrics;
  verdict: "improved" | "regressed" | "unchanged" | "new" | "missing-now";
}

/**
 * One row per chapter in a run folder's summary.json - everything needed to
 * compare a later run against this one without re-reading every full
 * trajectory file.
 */
export interface ChapterSummary {
  chapter: ChapterId;
  goalDescription: string;
  goalPassed: boolean;
  goalDetails: string;
  tokens: number;
  steps: number;
  wallMs: number;
  usage: UsageMetrics;
  contextReads: { docs: string[]; examples: string[] };
}

/**
 * One full run of a volume's chain(s), persisted as its own timestamped
 * folder: `results/result-of-run-<DD-MM-YY-HH-MMAM>-<runId>/` containing
 * `summary.json` (this shape), `trajectory/<chapter>.json` (the full
 * TrajectoryRun per chapter - every event, every prompt, the complete
 * conversation), and `workspace/` (a materialized copy of the real
 * workspace's text files at the end of the run, node_modules excluded -
 * install fresh with `pnpm install` to actually run it).
 */
export interface VolumeRunSummary {
  /** Short, unique id for this run (see run-folder.ts's generateRunId) - the one thing guaranteed to distinguish two runs, even two saved in the same folder-name minute. */
  runId: string;
  runFolder: string;
  runAt: string;
  provider: ProviderId;
  model: string;
  baseURL?: string;
  chapters: ChapterSummary[];
  /** Every chapter's usage, summed - the whole run's real token/cache cost. */
  totalUsage: UsageMetrics;
}
