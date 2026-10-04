import dagre from "@dagrejs/dagre";
import branding from "@/content/branding.json";
import type { ElectricalRFNode } from "./electricalNodes";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
function wrap(text: string, length = 42) {
  const lines: string[] = []; let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > length) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Native, self-contained SVG: no foreignObject, remote fonts or viewport clipping. */
export function diagramSvg(nodes: ElectricalRFNode[], edges: { source: string; target: string }[], notice: string, labels: Record<string, string>) {
  const fields = ["conductors", "conduit", "feederLength", "protection", "interruptingRating", "grounding"] as const;
  const boxes = nodes.map(node => {
    const rows = (node.data.kind === "grounding" ? ["grounding"] as const : fields).flatMap(field => wrap(`${labels[field]}: ${node.data[field] || labels.pending}`));
    if (node.data.rating) rows.unshift(node.data.rating);
    if (node.data.va != null) rows.unshift(`${node.data.va.toLocaleString()} VA${node.data.phase ? ` · ${node.data.phase}` : ""}`);
    if (node.data.note) rows.push(...wrap(node.data.note));
    const title = wrap(node.data.label, 30);
    return { node, rows, title, x: node.position.x, y: node.position.y, w: 320, h: 48 + title.length * 18 + rows.length * 17 };
  });
  const layout = new dagre.graphlib.Graph();
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
  boxes.forEach(box => layout.setNode(box.node.id, { width: box.w, height: box.h }));
  edges.filter(edge => layout.hasNode(edge.source) && layout.hasNode(edge.target)).forEach(edge => layout.setEdge(edge.source, edge.target));
  dagre.layout(layout);
  boxes.forEach(box => { const position = layout.node(box.node.id); box.x = position.x - box.w / 2; box.y = position.y - box.h / 2; });
  const left = Math.min(...boxes.map(b => b.x)) - 40;
  const top = Math.min(...boxes.map(b => b.y)) - 70;
  const width = Math.max(Math.max(...boxes.map(b => b.x + b.w)) - left + 40, 1000);
  const graphHeight = Math.max(...boxes.map(b => b.y + b.h)) - top + 40;
  const footer = wrap(notice, Math.floor(width / 8));
  const height = graphHeight + footer.length * 22 + 36;
  const text = (x: number, y: number, value: string, size = 12, bold = false) => `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="#111827">${escape(value)}</text>`;
  const paths = edges.map(edge => {
    const source = boxes.find(b => b.node.id === edge.source), target = boxes.find(b => b.node.id === edge.target);
    if (!source || !target) return "";
    const x1 = source.x + source.w / 2 - left, y1 = source.y + source.h - top;
    const x2 = target.x + target.w / 2 - left, y2 = target.y - top;
    const middle = (y1 + y2) / 2;
    const grounding = target.node.data.kind === "grounding";
    return `<path d="M ${x1} ${y1} V ${middle} H ${x2} V ${y2}" fill="none" stroke="${grounding ? '#166534' : '#374151'}" stroke-width="2"${grounding ? ' stroke-dasharray="6 3"' : ''}/>`;
  }).join("");
  const equipment = boxes.map(box => {
    const x = box.x - left, y = box.y - top;
    const symbol = box.node.data.kind === "grounding" ? `<path d="M ${x+20} ${y+10} v 12 m -10 0 h 20 m -16 5 h 12 m -9 5 h 6" stroke="#166534" fill="none" stroke-width="2"/>` : `<circle cx="${x+22}" cy="${y+22}" r="12" fill="white" stroke="#374151"/>${text(x+15,y+26,box.node.data.kind === "meter" ? "M" : box.node.data.kind === "spd" ? "S" : box.node.data.kind === "main_breaker" ? "Q" : box.node.data.kind === "panel" ? "T" : box.node.data.kind === "utility" ? "~" : "L",12,true)}`;
    return `<g><rect x="${x}" y="${y}" width="${box.w}" height="${box.h}" rx="6" fill="white" stroke="#6b7280"/>${symbol}${box.title.map((line,i) => text(x+44,y+25+i*18,line,13,true)).join("")}${box.rows.map((line,i) => text(x+14,y+48+box.title.length*18+i*17,line,12)).join("")}</g>`;
  }).join("");
  return { width, height, source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${text(24,28,branding.companyName+" · "+labels.title,18,true)}${paths}${equipment}${footer.map((line,i) => text(24,graphHeight+24+i*22,line,14)).join("")}</svg>` };
}

export async function downloadDiagram(container: HTMLElement, nodes: ElectricalRFNode[], format: "pdf" | "png" | "svg", notice: string, labels: Record<string, string>, edges: { source: string; target: string }[]) {
  if (!container.querySelector(".react-flow__viewport") || !nodes.length) throw new Error("Diagram is not ready");
  const { source, width, height } = diagramSvg(nodes, edges, notice, labels);
  let blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  if (format === "pdf") {
    const [{ jsPDF }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
    const pdf = new jsPDF({ orientation: width > height ? "landscape" : "portrait", unit: "pt", format: "a3" });
    const scale = Math.min((pdf.internal.pageSize.getWidth() - 48) / width, (pdf.internal.pageSize.getHeight() - 48) / height);
    const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
    await pdf.svg(svg, { x: 24, y: 24, width: width * scale, height: height * scale });
    blob = pdf.output("blob");
  }
  if (format === "png") {
    const imageUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Export failed")); img.src = imageUrl; });
      const canvas = document.createElement("canvas");
      canvas.width = width * 2; canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.scale(2,2); ctx.drawImage(img,0,0,width,height);
      blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Export failed")), "image/png"));
    } finally { URL.revokeObjectURL(imageUrl); }
  }
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.download = `sokol-unifilar.${format}`; anchor.href = url;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),60_000);
}
