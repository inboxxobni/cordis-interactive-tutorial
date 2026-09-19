import type { TraceEvent } from "@cordis-tutorial/shared";
import type { UsageMetrics } from "./types.js";

/**
 * Rolls up every real `llm_response` event's `usage` (from the real
 * provider - DeepSeek reports `prompt_cache_hit_tokens`/
 * `prompt_cache_miss_tokens` on every call, since its context caching is on
 * by default) into one summary: total input/output tokens, total cache
 * hit/miss tokens, and the resulting hit rate. `cacheHitTokens`/
 * `cacheMissTokens` stay `undefined` (not 0) when NO call in this set
 * reported them at all - so a provider that doesn't report caching shows up
 * as "unknown", not "0% hit rate".
 */
export function computeUsageMetrics(events: TraceEvent[]): UsageMetrics {
  const responses = events.filter((e): e is Extract<TraceEvent, { type: "llm_response" }> => e.type === "llm_response");

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let sawCacheReporting = false;

  for (const r of responses) {
    inputTokens += r.usage.input_tokens;
    outputTokens += r.usage.output_tokens;
    if (r.usage.cacheHitTokens !== undefined || r.usage.cacheMissTokens !== undefined) {
      sawCacheReporting = true;
      cacheHitTokens += r.usage.cacheHitTokens ?? 0;
      cacheMissTokens += r.usage.cacheMissTokens ?? 0;
    }
  }

  const cachedTotal = cacheHitTokens + cacheMissTokens;
  return {
    llmCalls: responses.length,
    inputTokens,
    outputTokens,
    cacheHitTokens: sawCacheReporting ? cacheHitTokens : undefined,
    cacheMissTokens: sawCacheReporting ? cacheMissTokens : undefined,
    cacheHitRate: sawCacheReporting && cachedTotal > 0 ? cacheHitTokens / cachedTotal : undefined,
  };
}

/** Sums a list of already-computed UsageMetrics (e.g. every chapter's, into one run-wide total). */
export function sumUsageMetrics(metrics: UsageMetrics[]): UsageMetrics {
  let llmCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;
  let sawCacheReporting = false;

  for (const m of metrics) {
    llmCalls += m.llmCalls;
    inputTokens += m.inputTokens;
    outputTokens += m.outputTokens;
    if (m.cacheHitTokens !== undefined || m.cacheMissTokens !== undefined) {
      sawCacheReporting = true;
      cacheHitTokens += m.cacheHitTokens ?? 0;
      cacheMissTokens += m.cacheMissTokens ?? 0;
    }
  }

  const cachedTotal = cacheHitTokens + cacheMissTokens;
  return {
    llmCalls,
    inputTokens,
    outputTokens,
    cacheHitTokens: sawCacheReporting ? cacheHitTokens : undefined,
    cacheMissTokens: sawCacheReporting ? cacheMissTokens : undefined,
    cacheHitRate: sawCacheReporting && cachedTotal > 0 ? cacheHitTokens / cachedTotal : undefined,
  };
}

export function formatUsageMetrics(m: UsageMetrics): string {
  const cache = m.cacheHitRate !== undefined ? `, cache hit ${(m.cacheHitRate * 100).toFixed(1)}% (${m.cacheHitTokens}/${(m.cacheHitTokens ?? 0) + (m.cacheMissTokens ?? 0)} tokens)` : ", cache: not reported";
  return `${m.llmCalls} LLM call(s), ${m.inputTokens} in / ${m.outputTokens} out tokens${cache}`;
}
