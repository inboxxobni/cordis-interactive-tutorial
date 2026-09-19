<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1-39 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Cordis System Guide for Coding Agents

> **End-to-end practical handbook for building on Cordis and DeepSeek Harness (`dsh`)**
> **Target:** DeepSeek Harness vendored `@deepseek-ai/cordis` and its Harness capability layer
> **Audience:** coding agents and engineers modifying, extending, or designing a Cordis-based agent harness
> **Research snapshot:** 2026-08-24
> **Primary implementation target:** this repository's pinned
> `deepseek-harness/` checkout at
> `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`, including its vendored Cordis
> source snapshot and local lifecycle/Loader patches. Public `master` is a
> comparison source, not authority for code in this checkout.

---

**Path convention:** Unless an ACRYL/root path is written explicitly, paths such
as `docs/...`, `packages/...`, and `vendor/...` in this guide are relative to
the pinned `deepseek-harness/` submodule.

## 0. Purpose of this document

This is a **single, operational A-to-Z tutorial**. It is designed so that a coding agent can read one file and then safely implement Cordis-style components without repeatedly rediscovering the architecture.

It explains:

- what Cordis is and is not;
- how the formal ideas in *A Programming Paradigm for Spatiotemporal Composability* map to real TypeScript code;
- how `Context`, `Fiber`, `Service`, `Registry`, effects, disposers, coeffects, injection, events, configuration, isolation, interception, Loader reconciliation, and HMR actually work;
- how DeepSeek Harness builds agent semantics on top of Cordis;
- how `tools`, `llm`, sessions, agents, prompt assembly, jobs, shell, filesystem, sandbox, and other capability seams fit together;
- how to build plugins, services, providers, consumers, tools, LLM adapters, event hooks, and policy wrappers;
- how to compose and hot-swap those pieces from `cordis.yml`;
- how to diagnose `PENDING`, failed, stale, leaking, or incorrectly wired plugins;
- how a coding agent should decide **which Cordis primitive to use** for a requested feature;
- which design rules are mandatory if we want components to be safely replaceable at runtime.

This is intentionally **not** a prose-only conceptual introduction. Every important concept has a concrete coding pattern, implementation rule, or diagnostic recipe.

---
