import { useStore } from "../store";

/**
 * CSS/DOM-animated node graph of the plugins mounted right now, with real
 * SVG edges drawn from each plugin's actual `inject` list to whichever
 * plugin's real service_provide event satisfied it. Positions are computed
 * from a deterministic grid (not measured via DOM refs), so node and edge
 * coordinates always agree with zero layout-sync code.
 */
const NODE_W = 168;
const NODE_H = 76;
const GAP_X = 56;
const GAP_Y = 40;
const COLS = 3;

function positionOf(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: col * (NODE_W + GAP_X), y: row * (NODE_H + GAP_Y) };
}

export function PluginGraph() {
  const plugins = useStore((s) => s.plugins);
  const serviceProviders = useStore((s) => s.serviceProviders);
  const nodes = Object.values(plugins);

  if (nodes.length === 0) {
    return <div className="plugin-graph empty">Run a chapter, or ask the agent to write and mount a plugin, to see it appear here.</div>;
  }

  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const rows = Math.ceil(nodes.length / COLS);
  const width = COLS * NODE_W + (COLS - 1) * GAP_X;
  const height = rows * NODE_H + Math.max(0, rows - 1) * GAP_Y;

  const edges = nodes.flatMap((node) =>
    node.inject.map((serviceName) => {
      const providerId = serviceProviders[serviceName];
      const providerIndex = providerId !== undefined ? indexOf.get(providerId) : undefined;
      return { fromId: node.id, toId: providerId, serviceName, providerIndex };
    }),
  );

  return (
    <div className="plugin-graph" style={{ width, height }}>
      <svg className="plugin-edges" width={width} height={height}>
        <defs>
          <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
        </defs>
        {edges.map((edge, i) => {
          const fromIndex = indexOf.get(edge.fromId);
          if (fromIndex === undefined) return null;
          const from = positionOf(fromIndex);
          const fromCenter = { x: from.x + NODE_W / 2, y: from.y + NODE_H / 2 };
          if (edge.providerIndex === undefined) {
            // Unmet dependency: no provider yet, draw a short dangling stub downward so it's still visible as "waiting".
            return (
              <g key={i}>
                <line x1={fromCenter.x} y1={from.y + NODE_H} x2={fromCenter.x} y2={from.y + NODE_H + 16} stroke="var(--pending)" strokeDasharray="3 3" strokeWidth={1.5} />
                <text x={fromCenter.x} y={from.y + NODE_H + 28} textAnchor="middle" fontSize={9} fill="var(--pending)">
                  needs {edge.serviceName}
                </text>
              </g>
            );
          }
          const to = positionOf(edge.providerIndex);
          const toCenter = { x: to.x + NODE_W / 2, y: to.y + NODE_H / 2 };
          return (
            <g key={i}>
              <line x1={fromCenter.x} y1={fromCenter.y} x2={toCenter.x} y2={toCenter.y} stroke="var(--active)" strokeWidth={1.5} markerEnd="url(#edge-arrow)" />
              <text x={(fromCenter.x + toCenter.x) / 2} y={(fromCenter.y + toCenter.y) / 2 - 6} textAnchor="middle" fontSize={9} fill="var(--active)">
                {edge.serviceName}
              </text>
            </g>
          );
        })}
      </svg>
      {nodes.map((node, i) => {
        const pos = positionOf(i);
        return (
          <div
            key={node.id}
            className={`plugin-node state-${node.state.toLowerCase()}`}
            style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H }}
            title={`${node.id}\nstate: ${node.state}${node.hasInject ? `\ninject: ${node.inject.join(", ")}` : ""}`}
          >
            <div className="plugin-node-name">{node.name}</div>
            <div className="plugin-node-state">{node.state}</div>
            {node.sourcePath && <div className="plugin-node-file">{node.sourcePath}</div>}
          </div>
        );
      })}
    </div>
  );
}
