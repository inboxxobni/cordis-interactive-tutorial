import { useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStore } from "../store";

/**
 * The live plugin canvas, on real xyflow/React Flow (https://reactflow.dev/)
 * instead of hand-rolled absolute-positioned divs + raw SVG lines: real
 * pan/zoom/drag, and edges drawn as real curves between whichever plugin's
 * `inject` list is actually satisfied by whichever plugin's real
 * `service_provide` event - not a static demo graph, this re-derives from
 * the store's `plugins`/`serviceProviders` on every real event.
 *
 * Nodes/edges are held in React Flow's own controlled state
 * (useNodesState/useEdgesState) and merged with fresh data on each change,
 * rather than replaced wholesale - so a node you've manually dragged to
 * untangle the graph keeps its position as more plugins mount around it.
 */
const NODE_WIDTH = 190;
const COLS = 3;
const GAP_X = 250;
const GAP_Y = 120;

function gridPosition(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: col * GAP_X, y: row * GAP_Y };
}

interface PluginNodeData extends Record<string, unknown> {
  name: string;
  state: string;
  sourcePath?: string;
  unmet: string[];
}

function PluginNode({ data }: NodeProps<Node<PluginNodeData>>) {
  return (
    <>
      {/* Both sides carry a target AND a source handle, stacked - which
          pair an edge actually uses is decided per-edge below, from the two
          nodes' real relative positions. A fixed left=target/right=source
          (the earlier version) forces every edge to exit a node's right
          side even when the other node sits to its left, looping the long
          way around instead of taking the near side. */}
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
      <div className="plugin-node-name">{data.name}</div>
      <div className="plugin-node-state">{data.state}</div>
      {data.sourcePath && <div className="plugin-node-file">{data.sourcePath}</div>}
      {data.unmet.length > 0 && <div className="plugin-node-unmet">needs {data.unmet.join(", ")}</div>}
    </>
  );
}

const nodeTypes = { plugin: PluginNode };

export function PluginGraph() {
  const plugins = useStore((s) => s.plugins);
  const serviceProviders = useStore((s) => s.serviceProviders);
  const activeEdgeId = useStore((s) => s.activeEdgeId);
  const clearActiveEdge = useStore((s) => s.clearActiveEdge);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PluginNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<ReactFlowInstance<Node<PluginNodeData>, Edge> | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  // Mirrors `nodes` without being a dependency of the effect below - reading
  // it there would need `nodes` in that effect's deps, and since it always
  // sets a brand-new node array, that would re-trigger itself forever.
  const latestNodesRef = useRef<Node<PluginNodeData>[]>([]);

  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const list = Object.values(plugins);
    const ids = new Set(list.map((p) => p.id));
    // React Flow's `fitView` prop only auto-fits once, at the graph's own
    // mount - which, since the canvas starts empty and this component
    // returns a completely different subtree while `plugins` is empty (see
    // below), happens against zero nodes. The very first real plugin (and
    // every later one) would then land wherever the default viewport
    // happens to be, possibly off-screen - looking exactly like "the agent
    // mounted it but nothing shows up". Detect any genuinely new node id
    // and fit the camera to it for real, once it's actually rendered.
    const hasNewNode = [...ids].some((id) => !knownIds.current.has(id));
    knownIds.current = ids;

    const byId = new Map(latestNodesRef.current.map((n) => [n.id, n]));
    const nextNodes: Node<PluginNodeData>[] = list.map((p, i) => {
      const existing = byId.get(p.id);
      const unmet = p.inject.filter((service) => serviceProviders[service] === undefined);
      return {
        id: p.id,
        type: "plugin",
        position: existing?.position ?? gridPosition(i),
        className: `plugin-node state-${p.state.toLowerCase()}`,
        style: { width: NODE_WIDTH },
        data: { name: p.name, state: p.state, sourcePath: p.sourcePath, unmet },
      };
    });
    setNodes(nextNodes);

    // Pick whichever pair of handles is actually the short path between the
    // two real node positions, instead of always exiting a node's right
    // side and entering the other's left side regardless of which one is
    // really to the left.
    const positionOf = new Map(nextNodes.map((n) => [n.id, n.position]));
    setEdges(
      list.flatMap((p) =>
        p.inject.flatMap((service): Edge[] => {
          const providerId = serviceProviders[service];
          if (!providerId || !ids.has(providerId)) return [];
          const from = positionOf.get(p.id);
          const to = positionOf.get(providerId);
          const sourceIsRightOfTarget = !!(from && to && from.x > to.x);
          return [
            {
              id: `${p.id}->${providerId}:${service}`,
              source: p.id,
              target: providerId,
              sourceHandle: sourceIsRightOfTarget ? "left-source" : "right-source",
              targetHandle: sourceIsRightOfTarget ? "right-target" : "left-target",
              label: service,
              animated: true,
              style: { stroke: "var(--live)" },
              markerEnd: { type: MarkerType.ArrowClosed, color: "var(--live)" },
            },
          ];
        }),
      ),
    );

    if (hasNewNode) {
      // Defer to the next frame so the new node has actually been
      // committed to the DOM before React Flow measures it to fit.
      requestAnimationFrame(() => rfInstance.current?.fitView({ padding: 0.3, duration: 300 }));
    }
  }, [plugins, serviceProviders, setNodes, setEdges]);

  // Volume 2's live data-flow moment (chapter 23): a real agent_llm_call/
  // agent_tool_call event sets this to the matching edge's real id in the
  // store; flash it briefly, then clear both the edge style and the store
  // flag so the next real call can flash it again.
  useEffect(() => {
    if (!activeEdgeId) return;
    setEdges((current) => current.map((e) => (e.id === activeEdgeId ? { ...e, className: "edge-flash" } : e)));
    const timer = window.setTimeout(() => {
      setEdges((current) => current.map((e) => (e.id === activeEdgeId ? { ...e, className: undefined } : e)));
      clearActiveEdge();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeEdgeId, setEdges, clearActiveEdge]);

  if (Object.keys(plugins).length === 0) {
    return <div className="plugin-graph empty">Run a chapter, or ask the agent to write and mount a plugin, to see it appear here.</div>;
  }

  return (
    <div className="plugin-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={(instance) => (rfInstance.current = instance)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148, 163, 184, 0.35)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
