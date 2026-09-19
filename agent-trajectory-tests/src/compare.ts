import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { ChapterComparison, ChapterSummary, VolumeRunSummary } from "./types.js";

/**
 * Finds the most recent PREVIOUS run folder for this volume (by each
 * folder's own summary.json `runAt` ISO timestamp - never by the
 * display-friendly folder name, which does not sort chronologically) and
 * compares every chapter's goal pass/fail and token cost against it. This
 * is the regression-tracking half of the harness: running the same chain
 * again after editing a chip's wording should show up here as
 * improved/regressed/unchanged, not just a fresh pass/fail in isolation.
 */
export async function compareToPreviousVolumeRun(volumeDir: string, current: VolumeRunSummary): Promise<{ previous: VolumeRunSummary | null; chapters: ChapterComparison[] }> {
  const resultsDir = path.join(volumeDir, "results");
  let entries: string[] = [];
  try {
    entries = await readdir(resultsDir);
  } catch {
    entries = [];
  }

  const summaries: VolumeRunSummary[] = [];
  for (const name of entries) {
    if (name === current.runFolder) continue;
    try {
      const raw = await readFile(path.join(resultsDir, name, "summary.json"), "utf8");
      summaries.push(JSON.parse(raw) as VolumeRunSummary);
    } catch {
      // not a run folder (or missing/corrupt summary.json) - skip
    }
  }

  const previous = summaries
    .filter((s) => s.runAt < current.runAt)
    .sort((a, b) => (a.runAt < b.runAt ? 1 : -1))[0] ?? null;

  if (!previous) {
    return {
      previous: null,
      chapters: current.chapters.map((c) => toComparison(c, null)),
    };
  }

  const previousByChapter = new Map(previous.chapters.map((c) => [c.chapter, c]));
  const chapters = current.chapters.map((c) => toComparison(c, previousByChapter.get(c.chapter) ?? null));

  // Chapters the previous run had but this run didn't (e.g. a narrower --chapter filter).
  const currentChapterIds = new Set(current.chapters.map((c) => c.chapter));
  for (const prev of previous.chapters) {
    if (!currentChapterIds.has(prev.chapter)) {
      chapters.push({
        chapter: prev.chapter,
        goalPassedBefore: prev.goalPassed,
        goalPassedNow: false,
        tokensBefore: prev.tokens,
        tokensNow: 0,
        stepsBefore: prev.steps,
        stepsNow: 0,
        usageBefore: prev.usage,
        usageNow: { llmCalls: 0, inputTokens: 0, outputTokens: 0 },
        verdict: "missing-now",
      });
    }
  }

  return { previous, chapters };
}

function toComparison(current: ChapterSummary, previous: ChapterSummary | null): ChapterComparison {
  if (!previous) {
    return {
      chapter: current.chapter,
      goalPassedBefore: null,
      goalPassedNow: current.goalPassed,
      tokensBefore: null,
      tokensNow: current.tokens,
      stepsBefore: null,
      stepsNow: current.steps,
      usageBefore: null,
      usageNow: current.usage,
      verdict: "new",
    };
  }
  let verdict: ChapterComparison["verdict"] = "unchanged";
  if (current.goalPassed && !previous.goalPassed) verdict = "improved";
  else if (!current.goalPassed && previous.goalPassed) verdict = "regressed";
  else if (current.goalPassed === previous.goalPassed && current.tokens < previous.tokens) verdict = "improved";
  else if (current.goalPassed === previous.goalPassed && current.tokens > previous.tokens) verdict = "regressed";

  return {
    chapter: current.chapter,
    goalPassedBefore: previous.goalPassed,
    goalPassedNow: current.goalPassed,
    tokensBefore: previous.tokens,
    tokensNow: current.tokens,
    stepsBefore: previous.steps,
    stepsNow: current.steps,
    usageBefore: previous.usage,
    usageNow: current.usage,
    verdict,
  };
}
