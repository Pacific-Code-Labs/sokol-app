import { Select } from "@pacific-code-labs/sokol-design-system";
/**
 * ElectricalDiagramEditor — interactive single-line diagram (FCR-102).
 *
 * An @xyflow/react canvas with the custom electrical nodeTypes. The engineer
 * can drag nodes, add/remove a load node, and edit the selected node's
 * label / VA / rating / phase / note in an on-select side panel. On any change
 * the editor debounces (~500ms) and POSTs { inputs, topology } to
 * /electrical/preliminary, then surfaces the returned ElectricalLoadData via
 * onChange so the parent can update the load table / kVA.
 *
 * Initial layout is computed with @dagrejs/dagre (top-down). A Download
 * SVG/PNG export uses html-to-image against the React Flow viewport.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  getNodesBounds,
  getViewportForBounds,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import { Plus, Trash2, LayoutDashboard, Loader2, ImageDown, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/contexts/LangContext";
import {
  sokolApi,
  type ElectricalInputs,
  type ElectricalLoadData,
  type Topology,
  type TopologyPhase,
} from "@/services/sokolApi";
import { electricalNodeTypes, type ElectricalRFNode } from "./electricalNodes";
import { topologyToFlow, flowToTopology, layoutNodes } from "./topologyLayout";

export interface ElectricalEditorValue {
  inputs: ElectricalInputs;
  topology: Topology;
}

interface Props {
  value: ElectricalEditorValue;
  /**
   * Called after each debounced recalculation with the fresh inputs/topology
   * and the BE result (or an error). The parent owns persistence + the load
   * table / kVA display.
   */
  onChange: (next: {
    inputs: ElectricalInputs;
    topology: Topology;
    result?: ElectricalLoadData;
    error?: unknown;
  }) => void;
}

const PHASES: TopologyPhase[] = ["A", "B", "C", "ABC"];
const DEBOUNCE_MS = 500;

function EditorInner({ value, onChange }: Props) {
  const { tr } = useLang();
  const flowRef = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => topologyToFlow(value.topology), [value.topology]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ElectricalRFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep stable refs so the debounced recalc always reads current graph state.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const inputsRef = useRef(value.inputs);
  inputsRef.current = value.inputs;

  const recalc = useCallback(() => {
    const topology = flowToTopology(nodesRef.current, edgesRef.current);
    // The deterministic engine derives the code-mandated loads (lighting under
    // the NEC 220.42 ladder, small-appliance/range/water-heater) from the
    // structured inputs. User-ADDED canvas loads (id `load-custom-*`) feed the
    // calc as `special_loads.other` so they are ADDITIVE (no double-count with
    // the auto/system load nodes). Editing/removing a custom node updates it.
    const base = inputsRef.current;
    const customOther = nodesRef.current
      .filter((n) => n.id.startsWith("load-custom-") && Number(n.data?.va ?? 0) > 0)
      .map((n) => ({ name: n.data?.label ?? "Load", va: Number(n.data?.va) || 0 }));
    const inputs: ElectricalInputs = {
      ...base,
      special_loads: { ...(base.special_loads ?? {}), other: customOther },
    };
    setIsCalculating(true);
    sokolApi
      .postElectricalPreliminary({ inputs, topology })
      .then((result) => onChangeRef.current({ inputs, topology, result }))
      .catch((error) => onChangeRef.current({ inputs, topology, error }))
      .finally(() => setIsCalculating(false));
  }, []);

  /** Schedule a debounced recalculation after any graph mutation. */
  const scheduleRecalc = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(recalc, DEBOUNCE_MS);
  }, [recalc]);

  // Recompute on mount AND whenever the parent changes the structured base
  // inputs (occupancy / area / service / growth / special loads) — NOT on
  // `other`, which the canvas owns (avoids a feedback loop).
  const baseInputsKey = JSON.stringify({
    o: value.inputs.occupancy,
    a: value.inputs.area_m2,
    s: value.inputs.service,
    f: value.inputs.floors,
    g: value.inputs.growth_allowance,
    r: value.inputs.special_loads?.range_va,
    w: value.inputs.special_loads?.water_heater_va,
    ac: value.inputs.special_loads?.ac_va,
    m: value.inputs.special_loads?.motors,
  });
  useEffect(() => {
    scheduleRecalc();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseInputsKey]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => addEdge({ ...c, type: "step" }, eds));
      scheduleRecalc();
    },
    [setEdges, scheduleRecalc],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedId(params.nodes[0]?.id ?? null);
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  /** Patch the selected node's data and schedule a recalc. */
  const patchSelected = useCallback(
    (patch: Partial<ElectricalRFNode["data"]>) => {
      if (!selectedId) return;
      setNodes((ns) =>
        ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
      scheduleRecalc();
    },
    [selectedId, setNodes, scheduleRecalc],
  );

  /** Add a new load node wired to the first panel (or the last node). */
  const addLoad = useCallback(() => {
    const id = `load-custom-${Date.now().toString(36)}`;
    const panel = nodesRef.current.find((n) => n.data.kind === "panel");
    const anchor = panel ?? nodesRef.current[nodesRef.current.length - 1];
    const newNode: ElectricalRFNode = {
      id,
      type: "load",
      position: anchor
        ? { x: anchor.position.x + 220, y: anchor.position.y + 120 }
        : { x: 0, y: 0 },
      data: { label: tr.elec_new_load, kind: "load", va: 1500, phase: "A" },
    };
    setNodes((ns) => [...ns, newNode]);
    if (anchor) {
      setEdges((eds) => [
        ...eds,
        { id: `e-${anchor.id}-${id}`, source: anchor.id, target: id, type: "step" },
      ]);
    }
    setSelectedId(id);
    scheduleRecalc();
  }, [setNodes, setEdges, scheduleRecalc, tr.elec_new_load]);

  /** Remove the selected node (only loads are removable) + its edges. */
  const removeSelected = useCallback(() => {
    if (!selectedNode || selectedNode.data.kind !== "load") return;
    const id = selectedNode.id;
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
    scheduleRecalc();
  }, [selectedNode, setNodes, setEdges, scheduleRecalc]);

  /** Re-run dagre auto-layout on the current graph. */
  const relayout = useCallback(() => {
    setNodes((ns) => layoutNodes(ns, edgesRef.current));
  }, [setNodes]);

  const exportImage = useCallback(
    async (format: "png" | "svg") => {
      const viewport = flowRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
      if (!viewport) return;
      const bounds = getNodesBounds(nodesRef.current);
      const width = Math.max(bounds.width + 80, 320);
      const height = Math.max(bounds.height + 80, 240);
      const { x, y, zoom } = getViewportForBounds(bounds, width, height, 0.5, 2, 0.1);
      const opts = {
        backgroundColor: "transparent",
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      };
      const dataUrl = format === "png" ? await toPng(viewport, opts) : await toSvg(viewport, opts);
      const a = document.createElement("a");
      a.setAttribute("download", `single-line-diagram.${format}`);
      a.setAttribute("href", dataUrl);
      a.click();
    },
    [],
  );

  return (
    <div className="flex h-full min-h-[420px] w-full flex-col gap-3 md:flex-row">
      <div ref={flowRef} className="relative h-full min-h-[420px] flex-1 overflow-hidden rounded-lg border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={electricalNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onNodeDragStop={scheduleRecalc}
          defaultEdgeOptions={{ type: "step" }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable className="!hidden sm:!block" />
          <Panel position="top-left" className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={addLoad}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {tr.elec_add_load}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={removeSelected}
              disabled={!selectedNode || selectedNode.data.kind !== "load"}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> {tr.elec_remove_load}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={relayout}>
              <LayoutDashboard className="mr-1 h-3.5 w-3.5" /> {tr.elec_auto_layout}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => exportImage("png")}>
              <ImageDown className="mr-1 h-3.5 w-3.5" /> {tr.elec_download_png}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => exportImage("svg")}>
              <FileDown className="mr-1 h-3.5 w-3.5" /> {tr.elec_download_svg}
            </Button>
          </Panel>
          {isCalculating && (
            <Panel position="top-right" className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr.elec_recalculating}
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* On-select edit panel — stacks below the canvas on mobile/tablet. */}
      <div className="w-full shrink-0 rounded-lg border border-border bg-card p-3 md:w-56">
        <div className="mb-2 text-xs font-semibold">{tr.elec_edit_node}</div>
        {!selectedNode ? (
          <p className="text-xs text-muted-foreground">{tr.elec_select_node_hint}</p>
        ) : (
          <div className="space-y-2.5">
            <label className="block space-y-1 text-[11px] text-muted-foreground">
              {tr.elec_node_label}
              <Input
                value={selectedNode.data.label}
                onChange={(e) => patchSelected({ label: e.target.value })}
                className="h-8 text-xs"
              />
            </label>
            <label className="block space-y-1 text-[11px] text-muted-foreground">
              {tr.elec_node_va}
              <Input
                type="number"
                value={selectedNode.data.va ?? ""}
                onChange={(e) =>
                  patchSelected({ va: e.target.value === "" ? undefined : Number(e.target.value) })
                }
                className="h-8 text-xs"
              />
            </label>
            <label className="block space-y-1 text-[11px] text-muted-foreground">
              {tr.elec_node_rating}
              <Input
                value={selectedNode.data.rating ?? ""}
                onChange={(e) => patchSelected({ rating: e.target.value || undefined })}
                className="h-8 text-xs"
              />
            </label>
            <label className="block space-y-1 text-[11px] text-muted-foreground">
              {tr.elec_node_phase}
              <Select
                value={selectedNode.data.phase ?? ""}
                onChange={(e) =>
                  patchSelected({ phase: (e.target.value || undefined) as TopologyPhase | undefined })
                }
                className="h-8 w-full rounded-md border border-input bg-background pl-2 pr-10 text-xs"
              >
                <option value="">—</option>
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block space-y-1 text-[11px] text-muted-foreground">
              {tr.elec_node_note}
              <Input
                value={selectedNode.data.note ?? ""}
                onChange={(e) => patchSelected({ note: e.target.value || undefined })}
                className="h-8 text-xs"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

export function ElectricalDiagramEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
