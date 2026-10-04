import { useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, type Edge } from "@xyflow/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLang } from "@/contexts/LangContext";
import { electricalNodeTypes, type ElectricalRFNode } from "./electricalNodes";
import { DiagramDownloadMenu, type DiagramFormat } from "./DiagramDownloadMenu";
import { downloadDiagram } from "./downloadDiagram";
import { toast } from "sonner";

/** Large read-only canvas for inspection and export, separate from editing. */
export function ElectricalDiagramModal({ open, onOpenChange, nodes, edges }: {
  open: boolean; onOpenChange: (open: boolean) => void; nodes: ElectricalRFNode[]; edges: Edge[];
}) {
  const { tr } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async (format: DiagramFormat) => {
    if (!ref.current) return;
    setBusy(true);
    try { await downloadDiagram(ref.current, nodes, format, tr.elec_diagram_preliminary, {
      conductors: tr.elec_conductors, conduit: tr.elec_conduit, feederLength: tr.elec_feeder_length,
      protection: tr.elec_protection, interruptingRating: tr.elec_interrupting_rating,
      grounding: tr.elec_grounding, pending: tr.elec_pending_validation, title: tr.elec_single_line,
    }, edges); }
    catch { toast.error(tr.elec_export_error); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[90dvh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col p-4 sm:p-6">
      <DialogHeader className="pr-6"><DialogTitle>{tr.elec_single_line}</DialogTitle><DialogDescription>{tr.diagram_viewer_hint}</DialogDescription></DialogHeader>
      <div className="flex justify-end"><DiagramDownloadMenu busy={busy} disabled={!nodes.length} onDownload={download} /></div>
      <div ref={ref} className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        <ReactFlowProvider><ReactFlow nodes={nodes} edges={edges} nodeTypes={electricalNodeTypes}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          panOnDrag zoomOnScroll zoomOnPinch minZoom={0.02} maxZoom={3}
          fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} proOptions={{ hideAttribution: true }}>
          <Background /><Controls showInteractive={false} />
        </ReactFlow></ReactFlowProvider>
      </div>
    </DialogContent>
  </Dialog>;
}
