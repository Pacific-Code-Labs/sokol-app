/**
 * React Flow custom node components for the electrical single-line diagram.
 *
 * One renderer per topology node type (utility/meter/main_breaker/spd/panel/
 * load). Each is token-driven (DS / Tailwind semantic tokens, never hardcoded
 * colors) and shows a lucide icon + the node label + an optional rating/VA line.
 *
 * The `nodeTypes` map is the single source consumed by both the interactive
 * editor (ElectricalDiagramEditor) and the read-only card (ElectricalLoadCard).
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  Zap,
  Gauge,
  ToggleLeft,
  ShieldCheck,
  LayoutGrid,
  Plug,
  Earth,
  type LucideIcon,
} from "lucide-react";
import type { TopologyNodeData, TopologyNodeType } from "@/services/sokolApi";
import { useLang } from "@/contexts/LangContext";
import { cn } from "@/lib/utils";

/** Data carried on every React Flow node (mirrors TopologyNode minus id/type). */
export interface ElectricalNodeData extends TopologyNodeData {
  label: string;
  /** Original topology node type — used to pick the renderer + accent. */
  kind: TopologyNodeType;
  [key: string]: unknown;
}

export type ElectricalRFNode = Node<ElectricalNodeData>;

const ICONS: Record<TopologyNodeType, LucideIcon> = {
  utility: Zap,
  meter: Gauge,
  main_breaker: ToggleLeft,
  spd: ShieldCheck,
  panel: LayoutGrid,
  load: Plug,
  grounding: Earth,
};

/** Format a VA value compactly (e.g. 12500 -> "12.5 kVA"). */
function formatVa(va?: number): string | null {
  if (va == null || Number.isNaN(va)) return null;
  if (va >= 1000) return `${(va / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kVA`;
  return `${va.toLocaleString()} VA`;
}

interface ShellProps {
  kind: TopologyNodeType;
  data: ElectricalNodeData;
  selected?: boolean;
  /** Source/target handles: the utility has no target; pure loads no source. */
  hasTarget?: boolean;
  hasSource?: boolean;
}

function NodeShell({ kind, data, selected, hasTarget = true, hasSource = true }: ShellProps) {
  const Icon = ICONS[kind];
  const { tr } = useLang();
  const detail = data.rating ?? formatVa(data.va);
  return (
    <div
      className={cn(
        "w-[280px] rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-sm transition-colors",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
      data-node-kind={kind}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-border !bg-muted-foreground"
        />
      )}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="break-words text-xs font-semibold leading-tight">{data.label}</div>
          {detail && (
            <div className="truncate text-[10px] text-muted-foreground">{detail}</div>
          )}
        </div>
      </div>
      {data.phase && (
        <div className="mt-1 inline-flex rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          {data.phase}
        </div>
      )}
      <dl className="mt-2 space-y-1 border-t border-border pt-2 text-[10px]">
        {(kind === "grounding" ? [[tr.elec_grounding, data.grounding]] : [
          [tr.elec_conductors, data.conductors], [tr.elec_conduit, data.conduit], [tr.elec_feeder_length, data.feederLength],
          [tr.elec_protection, data.protection], [tr.elec_interrupting_rating, data.interruptingRating],
          [tr.elec_grounding, data.grounding],
        ]).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || tr.elec_pending_validation}</dd></div>)}
      </dl>
      {data.note && <p className="mt-2 break-words text-[10px] text-muted-foreground">{data.note}</p>}
      {hasSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border-border !bg-muted-foreground"
        />
      )}
    </div>
  );
}

const UtilityNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="utility" data={p.data} selected={p.selected} hasTarget={false} />
));
UtilityNode.displayName = "UtilityNode";

const MeterNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="meter" data={p.data} selected={p.selected} />
));
MeterNode.displayName = "MeterNode";

const MainBreakerNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="main_breaker" data={p.data} selected={p.selected} />
));
MainBreakerNode.displayName = "MainBreakerNode";

const SpdNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="spd" data={p.data} selected={p.selected} />
));
SpdNode.displayName = "SpdNode";

const PanelNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="panel" data={p.data} selected={p.selected} />
));
PanelNode.displayName = "PanelNode";

const LoadNode = memo((p: NodeProps<ElectricalRFNode>) => (
  <NodeShell kind="load" data={p.data} selected={p.selected} hasSource={false} />
));
LoadNode.displayName = "LoadNode";

/** nodeTypes map for ReactFlow — keys match TopologyNodeType. */
const GroundingNode = memo((p: NodeProps<ElectricalRFNode>) => <NodeShell kind="grounding" data={p.data} selected={p.selected} hasSource={false} />);

export const electricalNodeTypes = {
  utility: UtilityNode,
  meter: MeterNode,
  main_breaker: MainBreakerNode,
  spd: SpdNode,
  panel: PanelNode,
  load: LoadNode,
  grounding: GroundingNode,
} as const;
