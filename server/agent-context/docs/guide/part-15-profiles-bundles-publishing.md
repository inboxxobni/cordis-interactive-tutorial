<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3308-3467 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: acryl-only. -->

# Part XV — Profiles, bundles, patches, and publishing

## 99. Bundle vs Profile

### Bundle

An npm package that contributes a configuration layer.

Manifest:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

Answers:

```text
“What does this package contribute to a composition?”
```

### Profile

A runnable named composition under Harness home.

Manifest concept:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "my-bundle"
      ]
    }
  }
}
```

Answers:

```text
“Which bundles compose this runtime, in what layer order?”
```

A bundle and a profile are different roles.

---

## 100. Bundle structure

Example:

```text
my-plugin/
├── package.json
├── cordis.patch.yml
└── index.js
```

`package.json`:

```json
{
  "name": "dsh-my-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

`cordis.patch.yml`:

```yaml
- insert:
    - id: my-plugin
      name: dsh-my-plugin
```

---

## 101. Install into a profile

```sh
dsh plugin --profile demo add ./my-plugin
```

Inspect effective config:

```sh
dsh --profile demo --dump-config
```

Run:

```sh
dsh --profile demo
```

Remove:

```sh
dsh plugin --profile demo remove dsh-my-plugin
```

---

## 102. Layer precedence

Current docs describe effective configuration layers in this order:

```text
1. bundle patches in profile bundle order
2. profile cordis.patch.yml
3. $DSH_HOME/cordis.patch.yml
4. each --patch overlay in argv order
```

Later layers win.

Important:

> A patch replacing an entry's `config` replaces that row's whole config value; do not assume arbitrary deep merge.

When overriding an earlier row, restate all required configuration keys.

---

## 103. Git install build-script warning

Installing from Git can fetch source without prebuilt artifacts.

For TypeScript packages, authors may need a self-contained `prepare` build.

Modern pnpm may require users to explicitly allow install-time builds.

Treat that permission as a security decision:

```text
allowing build scripts = allowing package code to execute at install time
```

Prefer pinned commits and trusted source.

For lower-friction distribution, publish built artifacts to npm or ship a tarball.

---
