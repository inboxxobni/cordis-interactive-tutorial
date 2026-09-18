import { PROVIDERS } from "@cordis-tutorial/shared";
import { useStore } from "../store";

/**
 * The real settings screen: every provider, its own persisted key/model/
 * baseURL (localStorage, per provider - see store.ts's CONFIGS_KEY), and a
 * test button per provider. Not a single deepseek-only input row.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const activeProvider = useStore((s) => s.activeProvider);
  const providerConfigs = useStore((s) => s.providerConfigs);
  const testing = useStore((s) => s.testing);
  const testResult = useStore((s) => s.testResult);
  const setActiveProvider = useStore((s) => s.setActiveProvider);
  const updateProviderConfig = useStore((s) => s.updateProviderConfig);
  const configure = useStore((s) => s.configure);
  const testConnection = useStore((s) => s.testConnection);
  const wipe = useStore((s) => s.wipe);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel-header">
          <h2>Settings</h2>
          <button className="btn ghost" onClick={onClose}>
            close
          </button>
        </div>
        <p className="muted">Each provider keeps its own API key, endpoint, and model - saved in this browser's localStorage, per provider.</p>

        {PROVIDERS.map((p) => {
          const cfg = providerConfigs[p.id] ?? { apiKey: "", baseURL: p.baseURL, model: p.models[0] ?? "" };
          const active = p.id === activeProvider;
          return (
            <details key={p.id} className="settings-provider" open={active}>
              <summary onClick={(e) => { e.preventDefault(); setActiveProvider(p.id); }}>
                {active && <span className="settings-provider-active">●</span>} {p.label}
              </summary>
              <div className="settings-provider-fields">
                {p.keyHint !== "(no key needed)" && (
                  <div className="settings-field">
                    <label>api key</label>
                    <input type="password" placeholder={p.keyHint} value={cfg.apiKey} onChange={(e) => updateProviderConfig(p.id, { apiKey: e.target.value })} />
                  </div>
                )}
                <div className="settings-field">
                  <label>endpoint URL</label>
                  <input type="text" placeholder={p.baseURL} value={cfg.baseURL} onChange={(e) => updateProviderConfig(p.id, { baseURL: e.target.value })} />
                </div>
                <div className="settings-field">
                  <label>model</label>
                  <div className="settings-model-row">
                    <select value={cfg.model} onChange={(e) => updateProviderConfig(p.id, { model: e.target.value })}>
                      {p.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input type="text" placeholder="or type a custom model id" value={p.models.includes(cfg.model) ? "" : cfg.model} onChange={(e) => updateProviderConfig(p.id, { model: e.target.value })} />
                  </div>
                </div>
                <div className="settings-field">
                  <span />
                  <a href={p.docsUrl} target="_blank" rel="noreferrer" className="settings-docs-link">
                    get a key ↗
                  </a>
                </div>
                <div className="settings-actions-row">
                  <button
                    className="btn primary"
                    onClick={() => {
                      setActiveProvider(p.id);
                      configure();
                    }}
                  >
                    use this provider
                  </button>
                  <button
                    className="btn ghost"
                    disabled={testing}
                    onClick={() => {
                      setActiveProvider(p.id);
                      testConnection();
                    }}
                  >
                    {testing ? "⟳ testing" : "▶ test"}
                  </button>
                  {active && testResult && (
                    <span className={`test-indicator ${testResult.ok ? "ok" : "fail"}`}>
                      <span className="test-dot" />
                      <span className="test-msg">{testResult.message}</span>
                    </span>
                  )}
                </div>
              </div>
            </details>
          );
        })}

        <div className="settings-actions">
          <button className="btn ghost danger" onClick={wipe}>
            wipe everything
          </button>
        </div>
      </div>
    </div>
  );
}
