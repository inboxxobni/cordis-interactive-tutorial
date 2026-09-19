# Cordis architecture docs

<!-- Generated from docs.json by server/scripts/sync-agent-docs.mjs. Do not edit here. -->

Read the file for your topic BEFORE implementing. Read it completely and follow
its cross-references (`see docs/...`) and the example files it names. Do not
guess from memory of a similar plugin. Working examples: `examples/README.md`.

## Start here

| Doc | Read it when | Applies here |
|---|---|---|
| [This sandbox vs real ACRYL/DSH](this-sandbox.md) | Always read first: what tools you have, what plugin file shapes work, what does not apply here. | applies |
| [Cordis usage cheatsheet (source-validated)](cheatsheet.md) | Fast one-page contract for Context, Service, inject, events, Fiber, effects. Includes doc-vs-source corrections. | applies |
| [Verifying your work](verifying-your-work.md) | Before claiming a plugin works or stating any live Fiber state. | applies |
| [Building the coding-agent harness](coding-agent-harness.md) | Building tools/llm/contextWindow/compaction/systemPrompt/agentLoop plugins. | applies |

## Handbook (Cordis System Guide for Coding Agents, split by Part)

| Doc | Read it when | Applies here |
|---|---|---|
| [Handbook (intro): Purpose of the handbook](guide/part-00-purpose.md) | Orientation only. | applies |
| [Handbook Part 1: The Cordis mental model](guide/part-01-mental-model.md) | Before writing your first plugin or when Cordis terms (Context, Fiber, Service, effect) are unclear. | applies |
| [Handbook Part 2: Theory translated into engineering](guide/part-02-theory.md) | Only when you need the WHY behind effects/disposers/LIFO cleanup. Skip for routine plugin work. | partial |
| [Handbook Part 3: The actual Cordis runtime (Context API)](guide/part-03-runtime.md) | Using ctx.extend/isolate/intercept, or unsure what ctx really exposes. | applies |
| [Handbook Part 4: Plugins and Fibers](guide/part-04-plugins-and-fibers.md) | Choosing a plugin shape (function/object/class), ctx.plugin(), Fiber states (PENDING is not an error), Registry. | applies |
| [Handbook Part 5: Effects: the lifecycle discipline](guide/part-05-effects.md) | Any timer, subscription, listener, or resource that outlives one apply() call. | applies |
| [Handbook Part 6: Services and live dependency injection](guide/part-06-services-and-inject.md) | ctx.provide / inject, required vs optional deps, provider replacement, three-role capability seams. | applies |
| [Handbook Part 7: Events](guide/part-07-events.md) | ctx.emit / on and the dispatch modes (parallel, serial, bail, waterfall), typed events. | applies |
| [Handbook Part 8: Plugin configuration](guide/part-08-configuration.md) | Config schemas (Schemastery), validation failure, config update/HMR. | applies |
| [Handbook Part 9: cordis.yml, Loader, reconciliation, HMR](guide/part-09-loader-and-hmr.md) | Only for real ACRYL/DSH composition via cordis.yml. Not used by mount_plugin. | acryl-only |
| [Handbook Part 10: DeepSeek Harness: Cordis as an agent runtime](guide/part-10-harness-runtime.md) | Understanding how Harness layers agent services on Cordis. | partial |
| [Handbook Part 11: Tools: from plugin to model-callable capability](guide/part-11-tools.md) | Writing a tool plugin (defineTool shape: name, parameters, output, execute) against a tools service. | applies |
| [Handbook Part 12: LLM adapters](guide/part-12-llm-adapters.md) | Implementing an llm service / provider adapter (stream/StreamChunk contract). | partial |
| [Handbook Part 13: End-to-end hands-on Cordis mini-system](guide/part-13-hands-on-mini-system.md) | A worked, multi-plugin build from scratch. Read before building anything multi-file. | applies |
| [Handbook Part 14: Three-role capability design](guide/part-14-three-role-capability.md) | Splitting a capability into Service Definition / Provider / Consumer. | applies |
| [Handbook Part 15: Profiles, bundles, patches, publishing](guide/part-15-profiles-bundles-publishing.md) | Only when packaging a plugin for a real ACRYL/DSH install. | acryl-only |
| [Handbook Part 16: Coding-agent decision framework](guide/part-16-decision-framework.md) | Deciding what kind of thing to build (plugin vs service vs event vs tool). | applies |
| [Handbook Part 17: Debugging](guide/part-17-debugging.md) | A plugin is PENDING, FAILED, silent, or duplicating after re-mount. | applies |
| [Handbook Part 18: Anti-pattern catalog](guide/part-18-anti-patterns.md) | Review your plugin against known mistakes before declaring it done. | applies |
| [Handbook Part 19: Designing self-updatable systems](guide/part-19-self-updatable-systems.md) | An agent building/replacing its own plugins (ACRYL self-extension). | applies |
| [Handbook Part 20: Testing Cordis components](guide/part-20-testing.md) | Verifying a plugin for real: mount it, read real fiber state. | applies |
| [Handbook Part 21: Practical reference: what should I use?](guide/part-21-what-should-i-use.md) | Quick lookup: capability -> Cordis primitive. | applies |
| [Handbook Part 22: Coding-agent rules: MUST / SHOULD / MUST NOT](guide/part-22-rules.md) | Read once before writing plugin code; the non-negotiables. | applies |
| [Handbook Part 23: Architecture review template](guide/part-23-architecture-review.md) | Reviewing a multi-plugin design. | partial |
| [Handbook Part 24: Applying the model to an ACRYL-style platform](guide/part-24-acryl-platform.md) | ACRYL-specific architecture; not needed for sandbox plugins. | acryl-only |
| [Handbook Part 25: Source-reading guide](guide/part-25-source-reading.md) | When docs are ambiguous and you must read the real @deepseek-ai/cordis source. | partial |
| [Handbook Part 26: Compact master reference](guide/part-26-compact-reference.md) | A one-page recap once you know the model. | applies |
| [Handbook Part 27: Final operating principles](guide/part-27-operating-principles.md) | The short principles list. | applies |
| [Handbook Appendix A: practical source map](guide/part-28-appendix-a-source-map.md) | Where things live in the real source. | partial |
| [Handbook Appendix B: completion checklist](guide/part-29-appendix-b-completion-checklist.md) | Run this checklist before claiming a plugin is done. | applies |
| [Handbook Appendix C: 30-second onboarding prompt](guide/part-30-appendix-c-onboarding-prompt.md) | Fastest orientation. | applies |

## ACRYL Desktop only (not used by mount_plugin)

| Doc | Read it when | Applies here |
|---|---|---|
| [Hello World plugin guide (bundles, profiles)](acryl/hello-world-plugin-guide.md) | Only when packaging/installing a plugin into real ACRYL Desktop. | acryl-only |
| [Cordis plugins index](acryl/README.md) | Index of the ACRYL-side plugin docs. | acryl-only |
