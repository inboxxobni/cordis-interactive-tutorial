import type { TraceEvent } from "@cordis-tutorial/shared";
import type { Goal, GoalContext, GoalResult } from "./types.js";

/**
 * Goal-check building blocks. Every one of these reads real TraceEvents or
 * real workspace files - the same ground truth the canvas/mount_plugin
 * result itself reports - never the agent's own closing message. An agent
 * that writes "done!" without a real ACTIVE fiber or a real file on disk
 * must fail here.
 */

function fiberStateChanges(events: TraceEvent[]): Extract<TraceEvent, { type: "fiber_state_change" }>[] {
  return events.filter((e): e is Extract<TraceEvent, { type: "fiber_state_change" }> => e.type === "fiber_state_change");
}

function pluginRegistrations(events: TraceEvent[]): Extract<TraceEvent, { type: "plugin_register" }>[] {
  return events.filter((e): e is Extract<TraceEvent, { type: "plugin_register" }> => e.type === "plugin_register");
}

/** Passes if any agent-authored plugin (registered from a real workspace file, sourcePath set) reached ACTIVE at some point in this chain. */
export function anyAgentPluginReachedActive(): Goal {
  return {
    description: "at least one agent-written plugin's fiber reaches ACTIVE",
    check(ctx: GoalContext): GoalResult {
      const registered = pluginRegistrations(ctx.events).filter((e) => !!e.sourcePath);
      const activeIds = new Set(fiberStateChanges(ctx.events).filter((e) => e.to === "ACTIVE").map((e) => e.pluginId));
      const hit = registered.find((r) => activeIds.has(r.pluginId));
      return hit
        ? { passed: true, details: `${hit.sourcePath} (pluginId ${hit.pluginId}) reached ACTIVE` }
        : { passed: false, details: `no agent-written plugin reached ACTIVE (registered: ${registered.map((r) => r.sourcePath).join(", ") || "none"})` };
    },
  };
}

/** Passes if some fiber (agent-written or not) reached FAILED - for chips that deliberately break a plugin to exercise the real failure path. */
export function anyFiberFailed(): Goal {
  return {
    description: "some plugin's fiber reaches FAILED (a deliberately broken plugin)",
    check(ctx: GoalContext): GoalResult {
      const failed = fiberStateChanges(ctx.events).find((e) => e.to === "FAILED");
      return failed ? { passed: true, details: `pluginId ${failed.pluginId} reached FAILED` } : { passed: false, details: "no fiber reached FAILED" };
    },
  };
}

/** Passes if a real config_error (real ValidationError) was observed - chapters 05/10's invalid-config steps. */
export function configErrorObserved(): Goal {
  return {
    description: "a real config_error (ValidationError) is observed",
    check(ctx: GoalContext): GoalResult {
      const err = ctx.events.find((e) => e.type === "config_error");
      return err ? { passed: true, details: (err as Extract<TraceEvent, { type: "config_error" }>).message } : { passed: false, details: "no config_error event" };
    },
  };
}

/** Passes if a fiber that was ACTIVE got disposed then a fiber (same or new id) reached ACTIVE again - chapter 06's edit-and-remount step. */
export function remountObserved(): Goal {
  return {
    description: "a fiber disposes then a (re)mount reaches ACTIVE again",
    check(ctx: GoalContext): GoalResult {
      const changes = fiberStateChanges(ctx.events);
      const disposedAt = changes.findIndex((e) => e.to === "DISPOSED" || e.to === "UNLOADING");
      if (disposedAt === -1) return { passed: false, details: "no DISPOSED/UNLOADING transition observed" };
      const activeAfter = changes.slice(disposedAt + 1).find((e) => e.to === "ACTIVE");
      return activeAfter
        ? { passed: true, details: `pluginId ${activeAfter.pluginId} reached ACTIVE after a prior dispose` }
        : { passed: false, details: "no ACTIVE transition observed after the dispose" };
    },
  };
}

/** Passes if the named service's real fiber never leaves PENDING for the whole chain - chapters demonstrating an unmet hard dependency. */
export function stuckPending(pluginIdHint?: RegExp): Goal {
  return {
    description: pluginIdHint ? `the fiber matching ${pluginIdHint} stays PENDING (never ACTIVE)` : "at least one fiber stays PENDING (never ACTIVE)",
    check(ctx: GoalContext): GoalResult {
      const changes = fiberStateChanges(ctx.events).filter((e) => (pluginIdHint ? pluginIdHint.test(e.pluginId) : true));
      if (changes.length === 0) return { passed: false, details: "no matching fiber_state_change observed at all" };
      const everActive = changes.some((e) => e.to === "ACTIVE");
      return everActive ? { passed: false, details: "a matching fiber reached ACTIVE (expected it to stay PENDING)" } : { passed: true, details: "matching fiber(s) never reached ACTIVE" };
    },
  };
}

/** Passes if a named tool ran without error at least once - chapters that register/exercise a real tool. */
export function toolRanOk(nameSubstr: string): Goal {
  return {
    description: `tool matching "${nameSubstr}" runs without error`,
    check(ctx: GoalContext): GoalResult {
      const hit = ctx.events.find((e): e is Extract<TraceEvent, { type: "tool_result" }> => e.type === "tool_result" && e.name.includes(nameSubstr) && !e.isError);
      return hit ? { passed: true, details: `${hit.name} -> ${hit.result.slice(0, 120)}` } : { passed: false, details: `no successful tool_result for a tool matching "${nameSubstr}"` };
    },
  };
}

/** Passes if a real workspace file matching `pattern` was written (created or edited) during this chain. */
export function fileWasWritten(pattern: RegExp): Goal {
  return {
    description: `a workspace file matching ${pattern} is written`,
    check(ctx: GoalContext): GoalResult {
      const hit = ctx.events.find((e): e is Extract<TraceEvent, { type: "file_changed" }> => e.type === "file_changed" && pattern.test(e.path));
      if (hit) return { passed: true, details: `${hit.path} (${hit.action})` };
      const inFinal = ctx.files.find((f) => pattern.test(f));
      return inFinal ? { passed: true, details: `${inFinal} present in final workspace (no file_changed event captured this run)` } : { passed: false, details: `no file matching ${pattern} written or present` };
    },
  };
}

/** Combines goals with AND - every one must pass; details are joined. */
export function all(...goals: Goal[]): Goal {
  return {
    description: goals.map((g) => g.description).join(" AND "),
    check(ctx: GoalContext): GoalResult {
      const results = goals.map((g) => g.check(ctx));
      return { passed: results.every((r) => r.passed), details: results.map((r, i) => `[${r.passed ? "pass" : "fail"}] ${goals[i]!.description}: ${r.details}`).join(" | ") };
    },
  };
}

/**
 * For reference-only/explanation chapters (11, 12, 14, 15, 16, 24): there is
 * nothing to mount, so the verifiable goal is simply that the agent
 * produced a real, non-empty answer - the chain still ran to completion,
 * not silently no-op'd or errored.
 */
export function producedAnswer(): Goal {
  return {
    description: "the agent's final turn produces a non-empty assistant_message",
    check(ctx: GoalContext): GoalResult {
      const msgs = ctx.events.filter((e): e is Extract<TraceEvent, { type: "assistant_message" }> => e.type === "assistant_message" && e.text.trim().length > 0);
      return msgs.length > 0 ? { passed: true, details: msgs[msgs.length - 1]!.text.slice(0, 160) } : { passed: false, details: "no non-empty assistant_message observed" };
    },
  };
}
