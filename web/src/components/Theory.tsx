import type { ChapterId } from "@cordis-tutorial/shared";
import { Term } from "./Tooltip";

/**
 * Hardcoded per-chapter content, same authoring model as aicodingagent-ts's
 * Theory.tsx (a plain switch, not a data-driven/MDX pipeline) — content
 * drawn from the official Cordis tutorial curriculum and this repo's own
 * chapter source.
 */
export function Theory({ chapter }: { chapter: ChapterId | null }) {
  if (!chapter) {
    return <p className="muted">Pick a chapter to see what it's teaching.</p>;
  }

  switch (chapter) {
    case "01-first-plugin":
      return (
        <div>
          <p>
            In the real DeepSeek Harness loader, a Cordis <Term tip="A module Cordis can mount and unmount.">plugin</Term> module
            named-exports an <code>apply</code> function. When Cordis loads it, it calls <code>apply</code> with a <strong>context</strong> —
            the <code>ctx</code> object through which the plugin registers everything it contributes.
          </p>
          <h3>Write the plugin</h3>
          <p>A minimal plugin is just this:</p>
          <pre className="theory-code">
            <code>{`export const name = 'hello'\n\nexport function apply(ctx) {\n  console.log('hello from my first plugin')\n}`}</code>
          </pre>
          <p>
            The <code>name</code> export is optional display metadata; it labels the plugin in diagnostics and in this tutorial's own
            canvas. In the harness's real loader, a YAML entry (<code>cordis.yml</code>) composes the app from a list of these modules —
            entries start concurrently, so list position guarantees nothing about which plugin loads first; ordering comes from service
            dependencies (<code>inject</code>, chapter 3), not from position in the file. This sandbox skips the YAML loader and mounts
            files directly via <code>mount_plugin</code>, but the plugin shape and the "no bootstrap code, dependencies decide order"
            rule are identical.
          </p>
          <h3>What happens when it loads</h3>
          <ol>
            <li>A root <code>Context</code> exists (this tutorial's server keeps one instrumented one alive for the whole session).</li>
            <li>Mounting resolves the plugin module.</li>
            <li>Cordis calls your <code>apply(ctx)</code>, and the <Term tip="The live runtime instance of one plugin application: PENDING, LOADING, ACTIVE, FAILED, UNLOADING, DISPOSED.">fiber</Term> moves PENDING → LOADING → ACTIVE.</li>
          </ol>
          <h3>The three plugin shapes</h3>
          <p>A function is the most common form, but Cordis accepts three:</p>
          <pre className="theory-code">
            <code>{`// 1. Function plugin (what you just wrote).\nexport function apply(ctx) {}\n\n// 2. Object plugin: an object with an apply method.\nexport const objectPlugin = {\n  name: 'object-plugin',\n  apply(ctx) {},\n}\n\n// 3. Class plugin: a Service subclass (see chapter 8 in this tutorial).\nclass MyService extends Service {\n  constructor(ctx) {\n    super(ctx, 'myTutorialService')\n  }\n}`}</code>
          </pre>
          <p>
            Use the function form until you need to expose a service; this tutorial's own chapter 8 covers when the object and class
            forms earn their place.
          </p>
          <h3>Try breaking it</h3>
          <p>
            Make <code>apply</code> throw, then mount it: the fiber goes straight to <code>FAILED</code>, and{" "}
            <code>mount_plugin</code> reports the real error back — a plugin that fails to load is a loud failure, not a skipped entry.
            One caveat worth knowing early: a config entry whose module cannot be <em>resolved</em> at all (a typo'd path) is reported
            through the logger instead of crashing the whole process in the harness's real YAML loader; in this sandbox, a bad path
            passed to <code>mount_plugin</code> comes back as an explicit "Import failed" tool result instead — still a real, visible
            failure either way, never silence.
          </p>
        </div>
      );
    case "02-lifecycle-and-effects":
      return (
        <div>
          <p>
            A Cordis plugin can be unloaded by a hot reload, explicit disposal, or loss of a required service. Registrations made through
            Cordis APIs are effects and are undone automatically when their owning plugin unloads; resources managed{" "}
            <em>outside</em> those APIs must be wrapped in{" "}
            <Term tip="Register a cleanup-aware effect: execute runs immediately, and the disposer it returns runs when the fiber unloads.">
              ctx.effect()
            </Term>
            .
          </p>
          <h3>Effects</h3>
          <p>For a resource Cordis does not already manage — a timer, a connection, a watcher — wrap it and return a disposer:</p>
          <pre className="theory-code">
            <code>{`function heartbeat(ctx) {\n  console.log('heartbeat plugin loading')\n  ctx.effect(() => {\n    const timer = setInterval(() => console.log('tick'), 200)\n    return () => {\n      clearInterval(timer)\n      console.log('heartbeat cleaned up')\n    }\n  })\n}`}</code>
          </pre>
          <p>Three things worth noticing:</p>
          <ul>
            <li>
              <code>ctx.plugin(heartbeat)</code> mounts a function <em>from code</em> as a plugin — a function plugin needs no{" "}
              <code>apply</code> method; Cordis calls the function directly. The call returns a <strong>fiber</strong>, the runtime
              handle for one loaded plugin instance.
            </li>
            <li>The effect body runs during load; the disposer it returns runs during unload. You never call the disposer yourself.</li>
            <li>
              <code>fiber.dispose()</code> resolves only after all of the plugin's cleanup — including async disposers — has finished,
              and recursively unloads any child plugins it mounted.
            </li>
          </ul>
          <h3>The fiber state machine</h3>
          <pre className="theory-code">
            <code>{`PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED\n                 ↘ FAILED`}</code>
          </pre>
          <ul>
            <li>
              <strong>PENDING</strong> — declared, but a required service (chapter 3) is not available yet.
            </li>
            <li>
              <strong>LOADING / ACTIVE</strong> — <code>apply</code> is running / has completed.
            </li>
            <li>
              <strong>FAILED</strong> — <code>apply</code> or config validation threw.
            </li>
            <li>
              <strong>UNLOADING / DISPOSED</strong> — disposers are running / everything is torn down.
            </li>
          </ul>
          <p>
            You'll meet PENDING again in chapter 6, where it's the usual answer to "why does my plugin print nothing?".
          </p>
          <h3>What is already an effect</h3>
          <p>You rarely write <code>ctx.effect()</code> yourself, because the built-in registration APIs are effects already:</p>
          <ul>
            <li>
              <code>ctx.on(event, listener)</code> — the listener is removed on unload (chapter 4).
            </li>
            <li>
              <code>ctx.plugin(child)</code> — the child is disposed with its parent.
            </li>
            <li>Service registrations are effects too — a real Harness tool registry unwinds automatically the same way (chapter 7).</li>
          </ul>
          <p>
            One ordering caveat: disposers start in reverse registration order, but multiple <em>async</em> disposers run concurrently.
            If teardown steps must run in sequence, keep them in one disposer and await them there.
          </p>
        </div>
      );
    case "03-services":
      return (
        <div>
          <p>
            A <strong>service</strong> is a named capability one plugin provides and other plugins consume through <code>ctx</code>. In
            the real harness, <code>ctx.tools</code>, <code>ctx.llm</code>, and <code>ctx.agents</code> are services. A consumer names
            the capability, such as <code>'tools'</code>, rather than importing its provider, so configuration can select a provider
            without changing the consumer.
          </p>
          <h3>Provide a service</h3>
          <p>
            The real harness exposes this via a <code>Service</code> subclass (a class plugin — chapter 8 covers that form); this
            sandbox's chapter uses the plain object-plugin form with <code>ctx.provide()</code> directly, which is the same runtime
            mechanism underneath:
          </p>
          <pre className="theory-code">
            <code>{`const greeterProvider = {\n  name: 'greeter-provider',\n  apply(ctx) {\n    ctx.provide('greeter', {\n      greet: (who) => \`Hello, \${who}!\`,\n    })\n  },\n}`}</code>
          </pre>
          <p>
            From then on, any plugin can reach it as <code>ctx.greeter</code>. The registration is an effect — unloading the provider
            removes the service.
          </p>
          <h3>Consume a service with inject</h3>
          <pre className="theory-code">
            <code>{`const greeterConsumer = {\n  name: 'greeter-consumer',\n  inject: ['greeter'],\n  apply(ctx) {\n    console.log(ctx.greeter.greet('Cordis'))\n  },\n}`}</code>
          </pre>
          <p>
            <code>inject</code> lists the services this plugin requires. Cordis holds the plugin{" "}
            <Term tip="Waiting for required services. This is healthy, not broken.">PENDING</Term> until every listed service exists, so
            inside <code>apply</code>, <code>ctx.greeter</code> is guaranteed ready. Load order does not matter — watch this chapter's
            canvas: the consumer is mounted <em>first</em> on purpose, registers PENDING, and only jumps to ACTIVE once the provider
            (mounted second) goes ACTIVE. Try removing the provider entirely in the workspace and re-mounting: the consumer stays
            PENDING and prints nothing — no crash, no partial run.
          </p>
          <h3>Dependencies are tracked after load</h3>
          <p>
            <code>inject</code> is not a one-shot boot check. If a required service disappears while the app runs — its provider was
            unloaded or hot-replaced — every dependent plugin is unloaded too, and loads again when the service returns. Combined with
            effects (chapter 2), this prevents a running consumer from retaining a reference to an unavailable service.
          </p>
          <h3>Optional dependencies</h3>
          <p><code>inject</code> is for hard requirements. For a capability the plugin can live without, skip it and probe at the use site:</p>
          <pre className="theory-code">
            <code>{`function apply(ctx) {\n  // undefined when no provider is loaded; the plugin still runs.\n  const greeter = ctx.get('greeter')\n  console.log(greeter?.greet('maybe') ?? 'no greeter available')\n}`}</code>
          </pre>
          <p>
            Service names live in one flat namespace per application — prefix or namespace your own services distinctively, since the
            harness claims plain names like <code>tools</code> and <code>llm</code>.
          </p>
        </div>
      );
    case "04-events":
      return (
        <div>
          <p>
            Services support direct calls; <strong>events</strong> let a plugin announce something without knowing which plugins
            listen. The real harness uses events for interactions such as tool results, model requests, and approval decisions.
          </p>
          <h3>Declare, emit, listen</h3>
          <pre className="theory-code">
            <code>{`ctx.on('stats/report', (name, count) => {\n  console.log(\`[stats] \${name} -> \${count}\`)\n})\n\nctx.emit('stats/report', 'tool_call', 1)`}</code>
          </pre>
          <p>
            The <code>namespace/action</code> naming convention keeps the flat event namespace readable. Because{" "}
            <code>ctx.on()</code> is an effect (chapter 2), the listener disappears with the plugin — no manual{" "}
            <code>removeListener</code> bookkeeping, ever.
          </p>
          <h3>Dispatch modes</h3>
          <p><code>emit</code> is one of five dispatch modes. Which one an event uses is part of its contract:</p>
          <table className="theory-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Call</th>
                <th>Semantics</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>emit</td>
                <td><code>ctx.emit(name, ...args)</code></td>
                <td>Synchronous broadcast; returned promises/values are not awaited or collected.</td>
              </tr>
              <tr>
                <td>parallel</td>
                <td><code>await ctx.parallel(name, ...args)</code></td>
                <td>All listeners run concurrently; awaited together.</td>
              </tr>
              <tr>
                <td>serial</td>
                <td><code>await ctx.serial(name, ...args)</code></td>
                <td>Listeners run in order; the first non-null/false/undefined return wins and stops the rest.</td>
              </tr>
              <tr>
                <td>bail</td>
                <td><code>ctx.bail(name, ...args)</code></td>
                <td>Synchronous version of serial.</td>
              </tr>
              <tr>
                <td>waterfall</td>
                <td><code>ctx.waterfall(name, ...args, next)</code></td>
                <td>Around-middleware — see below.</td>
              </tr>
            </tbody>
          </table>
          <h3>Waterfall: transform or short-circuit</h3>
          <p>
            Waterfall is the mode that powers interception. Each listener receives the arguments plus a <code>next()</code>{" "}
            continuation; it can transform what <code>next()</code> returns, or return without calling it and short-circuit the rest
            of the chain — what the Cordis docs call the <em>veto</em>:
          </p>
          <pre className="theory-code">
            <code>{`ctx.on('demo/transform', async (input, next) => {\n  const downstream = await next()\n  return downstream.toUpperCase()\n})\n\nctx.on('demo/transform', async (input, next) => {\n  if (input.includes('blocked')) return '** blocked **'\n  return next()\n})`}</code>
          </pre>
          <p>
            The discipline that follows: a waterfall listener that only observes or annotates <strong>must call next()</strong>;
            returning without it is a deliberate short-circuit. The real harness uses waterfalls for decisions cooperating plugins may
            wrap or answer — <code>agent/request</code> lets a plugin replace the model-call config, and{" "}
            <code>approval/request</code> lets a policy answer instead of the user.
          </p>
        </div>
      );
    case "05-configuration":
      return (
        <div>
          <p>
            Each mount can carry a config block, and the plugin declares a schema that validates it before <code>apply</code> runs. Bad
            config fails the load with a precise error — the plugin never starts half-configured.
          </p>
          <h3>A configurable plugin</h3>
          <pre className="theory-code">
            <code>{`import Schema from '@deepseek-ai/schemastery'\n\nexport const Config = Schema.object({\n  greeting: Schema.string().default('Hello'),\n  targets: Schema.array(String).default(['world']),\n})\n\nexport function apply(ctx, config) {\n  for (const target of config.targets) {\n    console.log(\`\${config.greeting}, \${target}!\`)\n  }\n}`}</code>
          </pre>
          <p>
            The exported <code>Config</code> is both a TypeScript interface and a runtime schema with the same name — consumers get
            the type, Cordis gets the validator. This declares a{" "}
            <Term tip="A shared interface for validators (Zod, Valibot, ArkType, or hand-written): one method, config['~standard'].validate(value), returning either {value} or {issues}.">
              Standard Schema
            </Term>
            . This repo uses <code>@deepseek-ai/schemastery</code> for schemas (not the npm <code>zod</code> package — see this
            tutorial's chapter 10 for how that got confirmed, not assumed); Cordis itself accepts any Standard-Schema-compatible
            validator.
          </p>
          <h3>Fail loud</h3>
          <p>
            Feed it something invalid — <code>{"{ targets: 'not-an-array' }"}</code> — and mounting fails immediately:
          </p>
          <pre className="theory-code">
            <code>{`ValidationError: invalid config:\n  - $.targets expected array but got not-an-array (at targets)`}</code>
          </pre>
          <p>
            The fiber goes straight to <code>FAILED</code>. Watch this chapter's canvas: the first mount gets valid config and reaches
            ACTIVE; the second gets deliberately-broken config, throws a real <code>ValidationError</code>, and the trace carries the
            exact message Cordis itself produced — not a paraphrase.
          </p>
        </div>
      );
    case "06-composition-and-hmr":
      return (
        <div>
          <p>
            Every capability built so far is a plugin. In the real harness, a YAML entry accepts metadata beyond a bare module
            reference:
          </p>
          <pre className="theory-code">
            <code>{`- id: greeter          # stable identity for this entry\n  name: './greeter.ts'\n- id: consumer\n  name: './consumer.ts'\n  disabled: true       # keep the entry, skip mounting it`}</code>
          </pre>
          <p>
            <code>id</code> gives the entry a stable identity so the loader can tell an edit to an existing entry apart from a removal
            plus an addition. <code>disabled: true</code> unmounts a plugin without deleting its entry.
          </p>
          <h3>Hot module replacement</h3>
          <p>
            Because unloading releases effects (chapter 2) and loading follows dependencies (chapter 3), HMR can replace a running
            plugin by unloading and loading it again. Real Cordis hot-reload is <code>fiber.update(newConfig)</code> — the{" "}
            <em>same</em> fiber (same identity, same <code>uid</code>) tears down its effects and re-runs <code>apply()</code> with the
            new config:
          </p>
          <pre className="theory-code">
            <code>{`hello from my first plugin\nhmr watching ['.']\nhmr reload plugin at hello.ts\nhello from my EDITED plugin`}</code>
          </pre>
          <p>
            This is different from this tutorial's own <code>mount_plugin</code>'s edit-then-remount, which creates a genuinely new
            fiber for a genuinely new file version — the right model when the agent rewrites a file, not when a config value changes
            on an already-loaded plugin. Watch the pluginId in the trace either way: real HMR keeps it identical across the reload,
            only the state changes.
          </p>
          <h3>Diagnosing a plugin that never loads</h3>
          <p>
            The flip side of dependency-driven loading: a plugin whose <code>inject</code> names a service nobody provides waits
            forever, printing nothing. No error — PENDING is a legitimate state, since the provider may be mounted later. When a
            plugin does nothing and reports nothing, inspect its fiber state on the canvas before assuming something crashed.
          </p>
        </div>
      );
    case "07-into-the-harness":
      return (
        <div>
          <p>
            This chapter registers a model-callable tool with the harness's <code>tools</code> service, executes it through the tool
            pipeline, and observes the result event. A real DeepSeek Harness tool is "a consumer of <code>ctx.tools</code>, not a
            Cordis primitive" — every pattern here is from the earlier chapters, just composed.
          </p>
          <h3>A tool plugin</h3>
          <pre className="theory-code">
            <code>{`export const inject = ['tools']\n\nexport function apply(ctx) {\n  ctx.tools.register(defineTool({\n    name: 'greet',\n    description: 'Greet the named person.',\n    parameters: { name: { type: 'string', required: true } },\n    async execute(args) {\n      return \`Hello, \${args.name}!\`\n    },\n  }))\n}`}</code>
          </pre>
          <p>
            <code>inject: ['tools']</code> (chapter 3) holds the plugin until the tool registry exists;{" "}
            <code>ctx.tools.register(...)</code> attaches the registration's disposer to the plugin (chapter 2), so unloading
            unregisters the tool automatically. A real <code>defineTool()</code> converts the parameters spec to the JSON Schema shown
            to the model, infers the type of <code>args</code>, and validates model-supplied arguments before <code>execute</code> runs.
          </p>
          <h3>An observer plugin</h3>
          <p>A separate plugin can watch every tool call in the app through the harness's own result event, without either plugin knowing the other exists:</p>
          <pre className="theory-code">
            <code>{`export const inject = ['tools']\n\nexport function apply(ctx) {\n  ctx.on('tools/result', (exec, result) => {\n    console.log(\`[tool-logger] \${exec.name} -> \${JSON.stringify(result.content)}\`)\n  })\n}`}</code>
          </pre>
          <p>
            The logger fires first: <code>tools/result</code> is emitted as part of result materialization, before{" "}
            <code>execute</code>'s promise resolves to the caller. The registry service and the event are the only thing connecting
            these two plugins.
          </p>
          <p>
            A real Harness swaps in its own richer tool registry (an LLM adapter, the agent loop, persistence, a real application
            entry) — the registration shape a plugin author writes stays exactly this shape. This tutorial's chapters 8-15 build on
            that: the three plugin forms, real ACRYL/Harness config conventions, and a practice chapter putting it all together.
          </p>
        </div>
      );
    case "08-plugin-forms":
      return (
        <div>
          <p>
            In Harness, a plugin is a module that exports an <code>apply</code> function; the framework calls it
            with a <code>ctx</code> context through which the plugin registers capabilities. That's the complete
            configuration — no separate manifest, no registration step outside the file itself. Cordis accepts a
            plugin as a <strong>function</strong>, an <strong>object literal</strong>, or a <strong>class</strong>.
            All three mounted in this chapter's canvas do the same thing, identically.
          </p>
          <h3>Object form</h3>
          <pre className="theory-code">
            <code>{`export default {\n  name: 'my-plugin',\n  inject: ['tools'],\n  apply(ctx) {\n    // ...\n  },\n}`}</code>
          </pre>
          <h3>Class form</h3>
          <pre className="theory-code">
            <code>{`import { Service } from '@deepseek-ai/cordis'\n\nexport default class MyService extends Service {\n  static inject = ['tools']\n\n  constructor(ctx) {\n    super(ctx, 'myService')\n    // Perform synchronous initialization in the constructor.\n  }\n}`}</code>
          </pre>
          <p>
            The class form extends{" "}
            <Term tip="A base class whose constructor calls super(ctx, name), which registers the instance as ctx.<name> automatically.">
              Service
            </Term>
            , which is the shape to reach for once a plugin's whole point is to <em>provide</em> a named capability
            (chapter 13) rather than just act on one. Function form is sufficient in most cases — use it until you
            need that.
          </p>
          <h3>Automatic cleanup, same as chapters 1-7</h3>
          <p>
            Anything registered through <code>ctx</code> — event listeners, tool registrations, timers wrapped in{" "}
            <code>ctx.effect()</code> — is cleaned up when the plugin unloads, with no manual bookkeeping. The
            harness's own registries follow the identical contract: <code>ctx.tools.register(tool)</code> and{" "}
            <code>ctx.llm.registerAdapter(names, adapter)</code> both attach their disposer to the calling plugin the
            same way <code>ctx.on()</code> does.
          </p>
        </div>
      );
    case "09-build-a-tool":
      return (
        <div>
          <p>
            A real ACRYL tool is <code>defineTool()</code> registered against an injected <code>tools</code>{" "}
            service. This chapter re-implements that exact contract minimally (matching{" "}
            <code>runtime/acryl-harness-runtime/src/plugin-acryl-workspace-status.ts</code> in the real ACRYL repo)
            so the sandbox stays dependency-free while teaching the real shape:
          </p>
          <pre className="theory-code">
            <code>{`export const inject = ['tools']\n\nexport function apply(ctx) {\n  ctx.tools.register(defineTool({\n    name: 'greet',\n    description: 'Greet someone by name.',\n    parameters: {\n      name: { type: 'string', required: true, description: 'The name to greet' },\n    },\n    output: {\n      schema: { type: 'string' },\n      render: (_args, value) => [{ type: 'text', text: value }],\n    },\n    async execute(args) {\n      return \`Hello, \${args.name}!\`\n    },\n  }))\n}`}</code>
          </pre>
          <p>
            <code>inject</code> makes Cordis wait for the tool registry before this plugin loads.{" "}
            <code>defineTool</code> infers and validates <code>args</code> from <code>parameters</code>;{" "}
            <code>execute</code> returns the canonical value declared by <code>output.schema</code>, and{" "}
            <code>output.render</code> separately converts that value to model-facing content — the two are
            deliberately split so the same tool result can be stored precisely and displayed differently. In the
            real harness's own Web UI, you'd test this by asking "Use the greet tool to greet Ada"; here, ask this
            tutorial's own agent to do the same and watch the tool actually get registered, then actually called, in
            the live trace.
          </p>
        </div>
      );
    case "10-acryl-config":
      return (
        <div>
          <p>
            ACRYL's real <code>Config</code> convention is <strong>Schemastery</strong> (
            <code>@deepseek-ai/schemastery</code>), not the npm <em>zod</em> package — grep the whole ACRYL repo and
            there is no <code>from 'zod'</code> import anywhere. <code>apps/acryl-desktop/src/updates.ts</code>{" "}
            imports Schemastery aliased as <code>z</code>, which reads like zod but isn't. Schemastery implements
            Standard Schema natively (its own <code>Schema.prototype['~standard']</code>), so it's a drop-in swap
            for chapter 5's hand-written validator, not a different mechanism underneath.
          </p>
          <h3>Stricter validation</h3>
          <pre className="theory-code">
            <code>{`export const Config = Schema.object({\n  apiKey: Schema.string().required(),\n  timeout: Schema.number().default(30000),\n  mode: Schema.union(['fast', 'accurate']).default('fast'),\n})`}</code>
          </pre>
          <h3>Design principle: don't hardcode tunables</h3>
          <p>The harness's own rule is that anything two deployments may want to set differently must be a configuration field:</p>
          <pre className="theory-code">
            <code>{`// Wrong: hardcoded timeout.\nconst TIMEOUT = 30000\n\n// Correct: configurable.\nexport interface Config {\n  timeoutMs: number  // Defaults to 30000.\n}`}</code>
          </pre>
          <p>
            The test is whether config can change the value without a code edit. Three principles, demonstrated for
            real in this chapter, not just stated: don't hardcode tunables (<code>intervalMs</code> is configurable),
            fail loudly on invalid config (a real <code>ValidationError</code> below, not a narrated one), and it
            works with HMR — a configuration edit hot-replaces the plugin, and because registrations are effects
            (chapter 2) that clean themselves up, replacement never retains the old instance's registrations.
          </p>
        </div>
      );
    case "11-package-and-install":
      return (
        <div>
          <p>
            Two concepts, two manifests, both described by a <code>package.json</code> but answering different
            questions: a <strong>bundle</strong> is an npm package that ships a configuration layer (its manifest
            declares <code>dsh.bundle</code> — "what does this package contribute?"); a <strong>profile</strong> is
            a directory describing one runnable composition (its manifest declares <code>dsh.profile</code> —
            "which bundles compose this setup, in what order?"). A bundle is what you author and distribute; a
            profile is what a user boots. Nothing is both.
          </p>
          <h3>The loading order</h3>
          <p>The effective configuration composes over an empty root by applying, in order:</p>
          <ol>
            <li>Each bundle patch named in the profile's bundle list, in list order.</li>
            <li>The profile's own patch layer.</li>
            <li>A home-level patch shared by every profile on the machine.</li>
            <li>Any command-line <code>--patch</code> overlays, in argv order.</li>
          </ol>
          <p>
            Later layers win per row, and — this is the part worth internalizing — <strong>a patch replaces a
            row's entire config value rather than deep-merging keys</strong>: overriding one field means restating
            every key that row needs, not just the changed one.
          </p>
          <h3>The build-script catch</h3>
          <p>
            Installing straight from a GitHub URL fetches <em>sources, not built artifacts</em> — nothing runs the
            package's build script, so a TypeScript package can arrive without its compiled output and fail to load.
            The package author must ship a self-contained <code>prepare</code> script; the installer must explicitly
            allowlist that build (pnpm ≥10 refuses to run a git dependency's install script otherwise). Treat that
            allowance as <strong>permission to execute the package's code on your machine at install time</strong> —
            only allow sources you trust, and pin a commit so a later push can't silently change what runs.
          </p>
          <p className="muted">
            Reference only — a real install needs pnpm and a real profile directory; this sandbox's{" "}
            <code>mount_plugin</code> deliberately sidesteps this whole path for local iteration. See the ACRYL
            repo's <code>.claude/skills/cordis-plugin-quickstart/</code> skill for the actual local-first equivalent.
          </p>
        </div>
      );
    case "12-built-in-services":
      return (
        <div>
          <p>
            In Harness, <code>ctx.tools</code>, <code>ctx.llm</code>, and <code>ctx.agents</code> are services —
            named capabilities mounted on <code>ctx</code> that any plugin can inject, exactly like chapter 3's{" "}
            <code>greeter</code>, just built into every real instance. Every ACRYL instance — even a blank one — has
            real named services already mounted. Three confirmed by reading the actual ACRYL source (not a generic
            list):
          </p>
          <ul>
            <li>
              <code>ctx.acrAgentControl</code> — <code>runtime/acryl-control/src/agent/agent-control.ts</code>{" "}
              (definition + provider), consumed via <code>inject: ['acrAgentControl']</code> in{" "}
              <code>runtime/acryl-control/src/agent/providers/factory.ts</code>.
            </li>
            <li>
              <code>ctx.acrRuntimeArchitecture</code> — <code>runtime/acryl-control/src/architecture/provider.ts</code>.
            </li>
            <li>
              <code>ctx.acrPluginLifecycle</code> — <code>runtime/acryl-control/src/plugin/provider.ts</code>,
              consumed in <code>runtime/acryl-harness-runtime/src/plugin-lifecycle.ts</code>.
            </li>
          </ul>
          <h3>Service isolation</h3>
          <p>
            Composition can isolate services so separate plugin groups see separate instances of the same service
            name — two groups can each get their own differently-configured Bash provider, for example, with no
            cross-group effect. This is what lets one service <em>name</em> stay stable while its concrete instance
            varies by context.
          </p>
          <h3>What the generated reference actually looks like</h3>
          <p>
            The Harness docs generate one page per subsystem (<code>docs/subsystems/*.md</code> — <code>core</code>{" "}
            alone runs to roughly 90 real services and events) directly from source, so it can never drift from the
            code. A real, trimmed excerpt from <code>core.md</code>'s generated <code>cordis-surface</code> block:
          </p>
          <pre className="theory-code">
            <code>{`### ctx.agentDefaultModel — AgentDefaultModelConfig\n\n/**\n * Read the current default model selection.\n * @returns a detached provider, model, and optional reasoning selection.\n */\ncurrentSelection(): ModelSelection\n\n/**\n * Save the complete default model selection.\n * @param next - resolved selection accepted by an entry point.\n */\nasync saveSelection(next: ModelSelection): Promise<void>`}</code>
          </pre>
          <p className="muted">
            Reference only. Treat each generated subsystem page and the service's own TypeScript interface as
            authoritative; don't maintain a second static list by hand — the three ACRYL services above are this
            tutorial's own confirmation that the pattern is real, not a substitute for reading the generated one.
          </p>
        </div>
      );
    case "13-three-role-capability":
      return (
        <div>
          <p>
            When a capability is general enough to need replaceable providers — Bash execution is the harness's own
            canonical example — it separates three roles: a <strong>Service Definition</strong>, a{" "}
            <strong>Service Provider</strong>, and a <strong>Consumer</strong>. Put the roles in separate packages
            only when they need to evolve or be replaced independently; a package may otherwise own more than one
            role. The complete capability is the seam — no individual role is.
          </p>
          <pre className="theory-code">
            <code>{`Service Definition        Service Provider          Consumer\n(dsh-shell)         --->  (dsh-bash-local)          (dsh-tool-bash)\n    ^                                                    |\n    +----------------------------------------------------+\n                     inject: ['shell']`}</code>
          </pre>
          <h3>Benefits of the split</h3>
          <ul>
            <li>
              <strong>Replace providers</strong> — one Service Definition can have multiple providers selected
              through configuration; the definition and consumer stay unchanged while the provider changes.
            </li>
            <li>
              <strong>Evolve independently</strong> — the definition changes rarely once callers depend on its
              contract; providers can improve performance or security on their own schedule; consumers can change
              how they present the capability to the model.
            </li>
            <li>
              <strong>Decouple dependencies</strong> — the provider and the consumer each depend on the definition,
              but never on each other.
            </li>
          </ul>
          <p>
            This chapter mirrors ACRYL's real <code>acrAgentControl</code> split (definition + provider in one file,
            consumer in another) at teaching scale: an <code>UppercaseService</code> definition, a local provider,
            and a tool that injects and calls it. Two design points worth keeping: <strong>do not split
            preemptively</strong> — a plugin with one effect and no external consumers doesn't need this — and{" "}
            <strong>explicit beats implicit</strong>: resolve defaults in an explicit step rather than hiding{" "}
            <code>?? default</code> expressions inside the run path.
          </p>
        </div>
      );
    case "14-llm-adapters":
      return (
        <div>
          <p>
            An LLM adapter extends <code>LlmAdapter</code> and implements one async generator:{" "}
            <code>async *stream(options: GenerateOptions): AsyncIterable{"<StreamChunk>"}</code>, translating
            Harness's provider-neutral request into a real API call and translating the response back into Harness
            chunks.
          </p>
          <h3>The StreamChunk protocol</h3>
          <p>Key rules, straight from the harness's own contract:</p>
          <ul>
            <li>Every <code>block-start</code> has a matching <code>block-end</code>.</li>
            <li><code>index</code> increases from 0 and identifies content-block order.</li>
            <li>A <code>tool-call-delta</code> carries raw JSON text in <code>argumentsDelta</code>, all at once or over multiple chunks.</li>
            <li><code>finish</code> is always the final chunk, and <code>usage</code> is emitted before it.</li>
          </ul>
          <pre className="theory-code">
            <code>{`yield { type: 'block-start', index: 0, blockType: 'text' }\nyield { type: 'text-delta', index: 0, text: 'Hello' }\nyield { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello' } }\nyield { type: 'usage', usage: { inputTokens: 100, outputTokens: 50 } }\nyield { type: 'finish', reason: { kind: 'stop' } }`}</code>
          </pre>
          <h3>Registering and errors</h3>
          <p>
            <code>ctx.llm.registerAdapter(['my-provider'], adapter)</code> lists the provider routes the adapter
            handles; <code>GenerateOptions.provider</code> selects it, while <code>GenerateOptions.model</code>{" "}
            passes an adapter-owned model id with no separate registration. Every provider HTTP request must merge{" "}
            <code>attributionHeaders()</code> and forward <code>options.signal</code>; failures are thrown as{" "}
            <code>LlmError</code> with a stable code — the agent loop preserves that error and code for diagnostics
            and policy, and never silently converts an ordinary <code>Error</code> for you.
          </p>
          <p>
            The real repo ships two complete, comparable implementations worth reading side by side:{" "}
            <code>packages/llm/llm-deepseek/</code> (OpenAI-compatible format) and{" "}
            <code>packages/llm/llm-pi-ai/</code> (a different API format) — the same harness contract, two different
            provider SDKs underneath.
          </p>
          <p className="muted">
            Reference only — a real adapter needs the full Harness LLM plumbing (provider registration,{" "}
            <code>GenerateOptions</code>, the real <code>StreamChunk</code> types) this sandbox doesn't pull in.
          </p>
        </div>
      );
    case "15-runtime-inspection-and-install":
      return (
        <div>
          <p>
            Two real ACRYL/Harness packages sound like they might do what this tutorial's <code>mount_plugin</code>{" "}
            does. Neither actually does:
          </p>
          <p>
            <code>@deepseek-ai/dsh-tool-cordis</code> is <strong>read-only inspection</strong> — two real tools,{" "}
            <code>cordis_inspect_list</code> (discover providers) and <code>cordis_inspect_query</code> (a
            provider's exact methods and types), so a model can build context before writing code. Its own docs are
            explicit about the boundary: "inspection cannot invoke service methods, configure plugins, or execute
            generated code."
          </p>
          <p>
            The <strong>Plugin Manager</strong> (<code>@deepseek-ai/dsh-plugin-manager</code>, exposed to a model as
            the <code>plugin_manager</code> tool) makes <strong>persistent, session-wide</strong> changes — it edits
            the profile's own patch layer and bundle list directly, and those changes affect every session sharing
            that profile immediately, surviving process restarts. Every one of its actions requires{" "}
            <code>danger-full-access</code> or explicit per-call approval — this is real write access to shared,
            persistent configuration, not a sandboxed preview. Installs are atomic: a failed or cancelled install
            restores the exact <code>package.json</code>/lockfile snapshot taken before pnpm ran, so a bad install
            can't leave the profile half-configured.
          </p>
          <h3>What that looks like end to end</h3>
          <p>
            The real flow: ask the agent (in Creator mode) to configure a new MCP server in the current profile. It
            writes a configuration-only bundle that inserts the right plugin package, then installs it through{" "}
            <code>plugin_manager install_bundle</code>. With HMR enabled, the new tools appear in the very same
            running session — verify both the management result (<code>application: applied</code>) and that the
            new tool actually answers a real call. A saved entry marked <code>restart-required</code> hasn't
            activated yet; one marked failed needs its configuration repaired.
          </p>
          <p>
            This tutorial's <code>mount_plugin</code> fills the gap neither package covers: mount a plugin for{" "}
            <em>this session only</em>, no persistent config write, gone if you don't graduate it.
          </p>
          <p className="muted">
            This tutorial's own agent now has a real, working version of the read-only half: ask it about any
            plugin's real state and it can call <code>cordis_inspect_list</code>/<code>cordis_inspect_query</code>{" "}
            for real, walking the live <code>ctx.registry</code> (chapter 6's own diagnostic API) - not a guess from
            your workspace file list, which can't see a compiled chapter's plugins at all.
          </p>
        </div>
      );
    case "16-what-is-an-agent":
      return (
        <div>
          <p>
            A coding agent is not magic. It is an LLM inside a loop that can call a small set of carefully designed
            tools, with a harness managing context, safety, and state so the model can keep solving the problem. The
            whole thing reduces to one line:
          </p>
          <pre className="theory-code">
            <code>{`Agent = LLM + control loop + tools + context management`}</code>
          </pre>
          <p>
            A plain chat UI is just the loop with <em>no</em> tools. A coding agent is the same loop with filesystem
            tools and careful context management - that is the entire conceptual leap. The model cannot do anything
            on its own; it only predicts the next token. To let it affect the world (read a file, edit code) you give
            it <strong>tools</strong>: a way for it to signal "run this," and a way for you to hand the result back.
          </p>
          <pre className="theory-code">
            <code>{`  LLM  <---- tools: request / result ---->  harness (this volume's agentLoop)\n                                                  |\n                                            reads / writes\n                                                  |\n                                                  v\n                                       workspace (real files, same as the rest of this tutorial)`}</code>
          </pre>
          <p>
            This project already has a real, minimal, non-Cordis version of this exact agent - <code>aicodingagent-ts</code>{" "}
            (~4 tools, plain TypeScript functions in a loop). Chapters 17-24 build the identical concept again, piece
            by piece, but every piece is now a real Cordis plugin, mounted into the same live Context the rest of
            this tutorial already uses - and DeepSeek Harness's own real agent (~170 plugins) is the same idea at
            production scale.
          </p>
        </div>
      );
    case "17-the-loop":
      return (
        <div>
          <p>Every coding agent, from Claude Code to Codex CLI, runs essentially this loop:</p>
          <pre className="theory-code">
            <code>{`while turn:\n  response = call_llm(messages, tools)\n  messages.append(response)\n  if response has tool_calls:\n    results = execute_tools(response.tool_calls)\n    messages.append(results)\n    continue          # loop - NO new user input yet\n  else:\n    return            # turn ends only when the model replies with no tool calls`}</code>
          </pre>
          <p>
            Two things worth noticing: the server is stateless (the full conversation is sent every call - the model
            has no hidden memory between them), and tool calls do not stop for the user - the harness runs them and
            calls the model again immediately.
          </p>
          <p>
            This is where you start building for real: ask the connected agent (right pane) to write{" "}
            <code>agent-loop.mjs</code> - a real Cordis class plugin implementing that loop:
          </p>
          <pre className="theory-code">
            <code>{`class AgentLoop extends Service {\n  static inject = ['tools', 'llm', 'systemPrompt']\n  constructor(ctx) { super(ctx, 'agentLoop') }\n  async runTurn(task) { /* the loop above, for real */ }\n}`}</code>
          </pre>
          <p>
            Have it <code>mount_plugin</code> that file right away. Watch the canvas: this fiber registers and stays{" "}
            <code>PENDING</code>, exactly like chapter 3's consumer with an unmet <code>inject</code> - because none
            of <code>tools</code>, <code>llm</code>, or <code>systemPrompt</code> exist yet. You won't touch this
            file again; the next five chapters each add one real dependency until it flips ACTIVE in chapter 22.
          </p>
          <p className="muted">
            Not a loose analogy: the real ACRYL CLI (<code>apps/acryl-cli/package.json</code>) depends on{" "}
            <code>@deepseek-ai/dsh-agent-loop</code> directly - the exact same real package this chapter's{" "}
            <code>AgentLoop</code> is a teaching-scale reimplementation of, same turn/step shape, same{" "}
            <code>static inject</code> pattern.
          </p>
        </div>
      );
    case "18-tools":
      return (
        <div>
          <p>
            An agent reaches outside its own context window through <strong>tools</strong>. Each one needs four
            things: a name, a description, an input schema, and an implementation. Ask the agent to write{" "}
            <code>tools.mjs</code>: a plugin providing a real <code>tools</code> service with the same four real file
            operations this tutorial's own outer agent uses (list/read/write/edit, using plain{" "}
            <code>node:fs/promises</code> - a workspace-mounted plugin only ever gets <code>ctx</code>, nothing
            private this tutorial's own server has) - registered the real <code>defineTool()</code>-shaped way
            chapter 9 already taught:
          </p>
          <pre className="theory-code">
            <code>{`ctx.provide('tools', {\n  definitions: [/* one ToolDefinition per real tool */],\n  async execute(name, input) {\n    // real fs.readFile/writeFile, resolved relative to this plugin's own file\n  },\n})`}</code>
          </pre>
          <p>
            Have it <code>mount_plugin</code> that file. Watch agentLoop's fiber: still <code>PENDING</code> - one
            dependency down, two to go (<code>llm</code>, <code>systemPrompt</code>).
          </p>
        </div>
      );
    case "19-context-window":
      return (
        <div>
          <p>
            Every call to the LLM sends the <strong>entire conversation</strong>: system prompt, every user/assistant
            message, every tool call and result. The model only "remembers" what's in this window right now - which
            is why production harnesses add context management: clipping long tool outputs, keeping a stable prefix
            for caching, and compacting once the window fills (next chapter).
          </p>
          <p>
            Ask the agent to write <code>context-window.mjs</code>: a plugin providing a real{" "}
            <code>contextWindow</code> service wrapping the same two pure functions already powering this tutorial's
            own outer agent (ported from aicodingagent-ts) - not new logic, a new real dependency surface for it:
          </p>
          <pre className="theory-code">
            <code>{`ctx.provide('contextWindow', {\n  estimateTokens(messages),        // rough token count, ~4 chars/token\n  sharedPrefixLength(prev, cur),   // how much of the request matches the last one, byte-for-byte\n})`}</code>
          </pre>
          <p>
            <code>sharedPrefixLength</code> is what "cacheable vs. new" actually means in the next chapter: a real
            provider can often reuse computation for a request's unchanged leading bytes.
          </p>
        </div>
      );
    case "20-cache-and-compact":
      return (
        <div>
          <p>
            Context windows are finite. Ask the agent to write <code>compaction.mjs</code>: a plugin that replaces
            older turns with one deterministic summary once the estimated token count crosses a threshold - the same
            algorithm aicodingagent-ts's own <code>/compact</code> command uses:
          </p>
          <pre className="theory-code">
            <code>{`compact(messages, keepRecent = 6):\n  keep the system prompt\n  keep the 6 newest messages\n  summarize everything older into one message\n  return [system, summary, ...recent]`}</code>
          </pre>
          <p>
            Unlike aicodingagent-ts's manual command, this is wired to a real Cordis event -{" "}
            <code>ctx.serial('agent-harness/compact', {"{ messages, estimatedTokens }"})</code>, the exact real
            dispatch mode chapter 4 already taught (first non-null/false/undefined listener return wins). agentLoop
            dispatches it before every LLM call; this plugin's listener only returns a replacement once the estimate
            crosses the threshold - otherwise it returns nothing, and the messages are left untouched. DeepSeek
            Harness's own real <code>compaction-basic</code> package hooks the equivalent real event (
            <code>agent/pre-step</code>) the identical way.
          </p>
        </div>
      );
    case "21-system-prompt":
      return (
        <div>
          <p>
            The system prompt is the stable prefix telling the model what it is and the rules of the sandbox - sent
            first, every turn. Ask the agent to write <code>system-prompt.mjs</code>: a plugin providing a real{" "}
            <code>systemPrompt</code> service that assembles a prompt string from the real tool list and the real
            file listing in this same directory:
          </p>
          <pre className="theory-code">
            <code>{`ctx.provide('systemPrompt', {\n  async assemble() {\n    const tools = ctx.tools.definitions\n    const files = await readdir(dir)   // dir = this plugin's own directory\n    return \`Your tools:\\n\${tools.map(t => t.name).join('\\n')}\\n\\nFiles:\\n\${files.join('\\n')}\`\n  },\n})`}</code>
          </pre>
          <p>
            Have it <code>mount_plugin</code> that file. Watch agentLoop's fiber one more time: still{" "}
            <code>PENDING</code> - every dependency it will ever need is now mounted except one. Next chapter is the
            payoff.
          </p>
        </div>
      );
    case "22-providers":
      return (
        <div>
          <p>
            The agent loop is provider-agnostic - DeepSeek, OpenAI, Claude, and the rest all support tool calling;
            they differ only in wire format. Ask the agent to write <code>llm.mjs</code>: a plugin providing a real{" "}
            <code>llm</code> service that makes a real HTTP call via <code>fetch</code> to whichever provider is
            already configured in this tutorial's own Settings panel - read from{" "}
            <code>process.env.CORDIS_AGENT_PROVIDER</code>/<code>_MODEL</code>/<code>_API_KEY</code>/
            <code>_BASE_URL</code> (bridged there the moment you configure a provider, so the raw key never has to
            appear in the agent's own transcript):
          </p>
          <pre className="theory-code">
            <code>{`ctx.provide('llm', {\n  async chat(messages, tools) {\n    const res = await fetch(\`\${process.env.CORDIS_AGENT_BASE_URL}/chat/completions\`, {\n      method: 'POST',\n      headers: { authorization: \`Bearer \${process.env.CORDIS_AGENT_API_KEY}\`, 'content-type': 'application/json' },\n      body: JSON.stringify({ model: process.env.CORDIS_AGENT_MODEL, messages, tools }),\n    })\n    return res.json()   // shaped into { text, toolCalls, ... } for agentLoop\n  },\n})`}</code>
          </pre>
          <p>
            Have it <code>mount_plugin</code> that file. <code>agentLoop</code>'s{" "}
            <code>static inject = ['tools', 'llm', 'systemPrompt']</code> is now fully satisfied for the first time.
            Watch the canvas: the fiber that has sat <code>PENDING</code> since chapter 17 flips to{" "}
            <code>ACTIVE</code> - the exact same PENDING-until-ready behavior chapter 3 first taught, just with five
            real chapters' worth of real dependencies behind it this time, built by the agent, not pre-seeded.
          </p>
        </div>
      );
    case "23-the-harness":
      return (
        <div>
          <p>
            The harness is everything around the model - once the loop works, the hard parts are all harness
            engineering: live repo context, prompt caching, structured tools with real validation, context reduction,
            and (in a production harness) session memory and subagents. By now all six files exist and the full
            composition sits <code>ACTIVE</code> on canvas - inert, zero LLM spend, until you actually ask it to do
            something.
          </p>
          <p>
            This chapter's suggestion chip is different from every other one in this tutorial: it asks the agent to
            call a new tool, <code>run_workspace_agent_turn</code>, which drives one real turn through the{" "}
            <code>agentLoop</code> you just built - a real LLM call, real tool calls against this same shared
            workspace. It's the only chip here that spends a real, billed LLM call just from being clicked. If{" "}
            <code>agent-loop.mjs</code> also calls <code>ctx.emit('agent-workspace/llm-call')</code>/
            <code>'agent-workspace/tool-call'</code> at the right moments, the canvas pulses the node live as it
            happens - a nice touch, not a requirement (the agent's own generated code varies run to run).
          </p>
        </div>
      );
    case "24-this-app":
      return (
        <div>
          <p>
            How this volume is actually built - the same honesty this tutorial's own "9 · this app" source
            (aicodingagent-ts) already models: nothing here was pre-seeded for you. Chapters 17-22 each asked the
            connected agent to write one real file, using <code>write_file</code> and <code>mount_plugin</code> -
            the exact same tools chapters 1-15 already use:
          </p>
          <ul>
            <li><code>workspace/agent-loop.mjs</code> - the <code>agentLoop</code> Service (chapter 17).</li>
            <li><code>workspace/tools.mjs</code> - the <code>tools</code> service (chapter 18).</li>
            <li><code>workspace/context-window.mjs</code> - the <code>contextWindow</code> service (chapter 19).</li>
            <li><code>workspace/compaction.mjs</code> - the <code>compaction</code> plugin (chapter 20).</li>
            <li><code>workspace/system-prompt.mjs</code> - the <code>systemPrompt</code> service (chapter 21).</li>
            <li><code>workspace/llm.mjs</code> - the <code>llm</code> service (chapter 22).</li>
          </ul>
          <p>
            Ask the agent to <code>read_file</code> each one back now and confirm they're really there - that's this
            chapter's suggestion. Nothing about the chapter-registration mechanism changed to add this volume: same
            real <code>CHAPTER_RUNNERS</code> map, same source-viewing route, same live Context - chapters 16-24
            just stopped mounting anything themselves, since the point was always for you to build it. The agent you
            built is real, sitting in this project's real <code>workspace/</code> directory: copy it anywhere,{" "}
            <code>pnpm install &amp;&amp; pnpm dev</code>, and it's a real, standalone, running coding agent - the
            same portable-workspace story every other chapter's files already share.
          </p>
          <p className="muted">
            And the shape isn't invented: the real ACRYL project (<code>apps/acryl-cli</code>,{" "}
            <code>runtime/acryl-control</code>) depends directly on DeepSeek Harness's own real{" "}
            <code>@deepseek-ai/dsh-agent-loop</code>, <code>dsh-llm</code>, and <code>dsh-tools</code> packages - the
            exact same production code the six files above are a teaching-scale reimplementation of. This is
            explicitly a minimal rehearsal for that real capability: directing an agent to build its own Cordis
            plugins for its own environment.
          </p>
        </div>
      );
    default:
      return <p className="muted">This chapter isn't implemented yet — see the corresponding file under server/src/chapters/.</p>;
  }
}
