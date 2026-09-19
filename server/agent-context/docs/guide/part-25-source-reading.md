<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4304-4366 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: partial. -->

# Part XXV — Source-reading guide for coding agents

## 140. Read docs in this order

For a new coding agent entering the codebase:

```text
1. docs/cordis-primer.md
2. docs/cordis-tutorial/index.md
3. docs/cordis-tutorial/01-first-plugin.md
4. 02-lifecycle-and-effects.md
5. 03-services.md
6. 04-events.md
7. 05-config.md
8. 06-composition-and-hmr.md
9. 07-into-the-harness.md
10. docs/architecture.md
11. owning docs/subsystems/<domain>.md
12. owning package README/types/source
13. vendor/cordis source only when behavior remains unclear
```

For tool work also read:

```text
docs/cookbook/adding-a-tool.md
packages/core/tools/README.md
```

For LLM work:

```text
docs/user/develop/practice/llm-adapter.md
packages/llm/llm*/
```

---

## 141. Inspect implementation before guessing

High-value files:

```text
vendor/cordis/src/context.ts
vendor/cordis/src/fiber.ts
vendor/cordis/src/registry.ts
vendor/cordis/src/service.ts
vendor/cordis/src/events.ts
vendor/README.md
```

These answer questions such as:

- what exact Fiber states exist;
- when config is resolved;
- how dependencies trigger activation;
- what an effect can return;
- what `dispose()` waits for;
- how event modes actually dispatch;
- which behavior differs from upstream Cordis.

---
