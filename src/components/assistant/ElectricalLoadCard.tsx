/**
 * ElectricalLoadCard — READ-ONLY render of an ElectricalLoadData snapshot for
 * the chat / demo (FCR-102). Non-editable: a compact ReactFlow single-line
 * diagram (not draggable / not connectable, fitView, no minimap), a panel-
 * schedule table, a recharts phase-balance bar chart, a mandated-provisions
 * checklist, assumptions / references, and the disclaimer. Bilingual via useLang.
 */
import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Check, Info, Zap } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import type { ElectricalLoadData } from "@/lib/assistantResponse";
import { electricalNodeTypes, type ElectricalRFNode } from "@/components/electrical/electricalNodes";
import { topologyToFlow } from "@/components/electrical/topologyLayout";

import { ElectricalDiagramModal } from "@/components/electrical/ElectricalDiagramModal";
import { Button } from "@/components/ui/button";

interface Props {
  data: ElectricalLoadData;
  hideCodeRules?: boolean;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—";
}

/** Phase accent colors cycle over the four fire-protection category tokens. */
const PHASE_COLORS = [
  "hsl(var(--cat-initiation))",
  "hsl(var(--cat-notification))",
  "hsl(var(--cat-monitoring))",
  "hsl(var(--cat-actuation))",
];

function Diagram({ nodes, edges }: { nodes: ElectricalRFNode[]; edges: Edge[] }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  return <div className="space-y-2">
    <div className="relative h-56 w-full overflow-hidden rounded-md border border-border bg-background/40">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={electricalNodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll={false}
          minZoom={0.05}
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
      <Button variant="ghost" className="absolute inset-0 z-10 h-full w-full items-end justify-end rounded-none p-3" onClick={() => setOpen(true)} aria-label={tr.diagram_open}>
        <span className="rounded-md border bg-background px-3 py-2 text-xs">{tr.diagram_open}</span>
      </Button>
    </div>
    <ElectricalDiagramModal open={open} onOpenChange={setOpen} nodes={nodes} edges={edges} />
  </div>;
}

export function ElectricalLoadCard({ data, hideCodeRules = false }: Props) {
  const { tr } = useLang();
  const flow = useMemo(
    () => topologyToFlow(data.topology ?? { nodes: [], edges: [] }),
    [data.topology],
  );
  const phaseData = (data.phaseBalance ?? []).map((p) => ({ phase: p.phase, va: p.va }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Zap className="h-4 w-4" /> {tr.elec_title}
      </div>

      <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">{tr.elec_diagram_preliminary}</p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4">
        <Stat label={tr.elec_installed_va} value={`${fmt(data.installedVa)} VA`} />
        <Stat label={tr.elec_demanded_load} value={`${fmt(data.demandedVa)} VA`} />
        <Stat label={tr.elec_demand_kva} value={`${fmt(data.demandKva)} kVA`} />
        <Stat
          label={tr.elec_suggested_transformer}
          value={`${fmt(data.suggestedTransformerKva)} kVA`}
        />
      </div>

      {/* Single-line diagram (read-only) */}
      {flow.nodes.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold">{tr.elec_single_line}</div>
          <Diagram nodes={flow.nodes} edges={flow.edges} />
        </div>
      )}

      {/* Panel schedule */}
      {data.loadTable?.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <div className="border-b border-border bg-background/40 px-2 py-1 text-xs font-semibold">
            {tr.elec_panel_schedule}
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-1 text-left font-medium">{tr.elec_col_description}</th>
                <th className="px-2 py-1 text-right font-medium">{tr.elec_col_connected_va}</th>
                <th className="hidden px-2 py-1 text-right font-medium md:table-cell">{tr.elec_col_demand_factor}</th>
                <th className="px-2 py-1 text-right font-medium">{tr.elec_col_demanded_va}</th>
                <th className="hidden px-2 py-1 text-left font-medium sm:table-cell">{tr.elec_col_phase}</th>
              </tr>
            </thead>
            <tbody>
              {data.loadTable.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1">{row.description}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmt(row.connectedVa)}</td>
                  <td className="hidden px-2 py-1 text-right font-mono md:table-cell">{fmt(row.demandFactor)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmt(row.demandedVa)}</td>
                  <td className="hidden px-2 py-1 font-mono text-muted-foreground sm:table-cell">{row.phase ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Phase balance chart */}
      {phaseData.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <div className="mb-1 text-xs font-semibold">{tr.elec_phase_balance}</div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="phase" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={48} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="va" radius={[3, 3, 0, 0]}>
                  {phaseData.map((_, i) => (
                    <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mandated provisions checklist */}
      {!hideCodeRules && data.mandatedProvisions?.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <div className="mb-1.5 text-xs font-semibold">{tr.elec_mandated_provisions}</div>
          <ul className="space-y-1.5">
            {data.mandatedProvisions.map((p, i) => {
              const required = p.status === "required";
              return (
                <li key={i} className="flex gap-2 text-xs leading-relaxed">
                  {required ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--risk-medium))]" aria-hidden />
                  ) : (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  )}
                  <span>
                    <span className="font-semibold">{p.code}</span> — {p.requirement}{" "}
                    <span className="opacity-70">({p.reference})</span>{" "}
                    <span className="rounded border border-border px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {required ? tr.elec_status_required : tr.elec_status_info}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Assumptions */}
      {data.assumptions?.length > 0 && (
        <div className="rounded-md border border-border bg-background/30 p-2 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground/80">
            <Info className="h-3.5 w-3.5" /> {tr.elec_assumptions}
          </div>
          <ul className="space-y-0.5">
            {data.assumptions.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* References */}
      {!hideCodeRules && data.references?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">{tr.elec_references}:</span>
          {data.references.map((r) => (
            <span key={r} className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs italic text-muted-foreground">
        {data.disclaimer || tr.elec_disclaimer_note}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
