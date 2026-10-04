import type { Project } from "@/hooks/useProjects";
import type { Dict, Lang } from "@/lib/i18n";
import { sokolApi, BuildingType, type RuleDTO } from "@/services/sokolApi";
import { topologyToFlow } from "@/components/electrical/topologyLayout";
import { diagramSvg } from "@/components/electrical/downloadDiagram";

/** Export every matching rule page, rather than only the currently visible page. */
export async function createProjectPdf(project: Project, lang: Lang, tr: Dict) {
  const rules: RuleDTO[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await sokolApi.getRules({ building_type: project.building_type, usage: project.usage,
      area_m2: project.area_m2 || undefined, floors: project.floors, occupants: project.occupants,
      ceiling_height_m: project.ceiling_height_m, volume_m3: project.volume_m3,
      page, page_size: 100, language: lang });
    rules.push(...result.data.flatMap(group => group.rules));
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page < totalPages);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  let y = margin;
  const text = (value: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const clean = value.replace(/[–—]/g, "-").replace(/Ω/g, "ohm").replace(/→/g, "->");
    const lines: string[] = pdf.splitTextToSize(clean, pdf.internal.pageSize.getWidth() - margin * 2);
    const lineHeight = size * 0.48;
    for (const line of lines) {
      if (y + lineHeight > pdf.internal.pageSize.getHeight() - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += 2;
  };
  const section = (title: string) => { y += 4; text(title, 13, true); };
  const list = (items?: string[]) => { if (items?.length) items.forEach(item => text(`- ${item}`)); else text(tr.no_data); };
  text(project.name, 18, true);
  text(`${tr.created}: ${new Date(project.createdAt).toLocaleString(lang)}`);
  section(tr.project_info);
  const building = project.building_type === BuildingType.residencial ? tr.bt_residential : project.building_type === BuildingType.industrial ? tr.bt_industrial : tr.bt_commercial;
  const details = [[tr.building_type, building], [tr.usage_label, project.usage], [tr.area, `${project.area_m2} m²`],
    [tr.floors, project.floors], [tr.occupants, project.occupants], [tr.ceilingHeight, project.ceiling_height_m], [tr.volume, project.volume_m3], [tr.risk_label, project.risk]];
  details.forEach(([label, value]) => { if (value != null) text(`${label}: ${value}`); });
  section(tr.project_notes); text(project.notes || tr.no_data);
  section(tr.requirements); list(project.requirements);
  section(tr.references); list(project.reference);
  section(tr.cr_context); list(project.contextCr);
  section(tr.project_nfpa_rules_title);
  if (!rules.length) text(tr.project_rules_empty);
  for (const rule of rules) {
    text(`${rule.standard}: ${rule.title}`, 11, true);
    text(rule.description);
    list(rule.technical_requirements);
    if (rule.installation_requirements?.length) { text(tr.project_rule_installation, 10, true); list(rule.installation_requirements); }
    if (rule.inspection_requirements?.length) { text(tr.project_rule_inspection, 10, true); list(rule.inspection_requirements); }
    if (rule.conditions?.length) { text(tr.project_rule_conditions, 10, true); list(rule.conditions); }
    if (rule.applies_to?.length) { text(tr.project_rule_applies, 10, true); list(rule.applies_to); }
    if (rule.failure_risks?.length) { text(tr.project_rule_failure, 10, true); list(rule.failure_risks); }
  }
  const study = project.electrical?.result;
  section(tr.project_electrical_rules_title);
  if (!study) text(tr.project_electrical_rules_missing);
  else {
    const inputs = project.electrical!.inputs;
    section(tr.project_electrical_inputs);
    text(`${tr.elec_occupancy}: ${tr[`elec_occ_${inputs.occupancy}`] || inputs.occupancy}`);
    text(`${tr.elec_service_type}: ${tr[`elec_svc_${inputs.service}`] || inputs.service}`);
    text(`${tr.elec_area}: ${inputs.area_m2} m²`);
    if (inputs.floors != null) text(`${tr.floors}: ${inputs.floors}`);
    if (inputs.voltage != null) text(`${tr.project_voltage}: ${inputs.voltage} V`);
    if (inputs.growth_allowance != null) text(`${tr.elec_growth}: ${inputs.growth_allowance * 100}%`);
    const loads = inputs.special_loads;
    if (loads) {
      for (const [key, label] of [["range_va", tr.elec_range], ["water_heater_va", tr.elec_water_heater], ["ac_va", tr.elec_ac]] as const) {
        if (loads[key] != null) text(`${label}: ${loads[key]} VA`);
      }
      for (const load of loads.other ?? []) text(`${load.name}: ${load.va} VA`);
      for (const motor of loads.motors ?? []) text(`${tr.project_motor}${motor.name ? ` (${motor.name})` : ""}: ${motor.hp != null ? `${motor.hp} HP` : `${motor.kw ?? 0} kW`} x ${motor.quantity ?? 1}`);
    }
    section(tr.elec_title);
    text(`${tr.elec_installed_va}: ${study.installedVa} VA`);
    text(`${tr.elec_demanded_load}: ${study.demandedVa} VA / ${study.demandKva} kVA`);
    text(`${tr.elec_suggested_transformer}: ${study.suggestedTransformerKva} kVA`);
    if (study.notes) text(study.notes);
    for (const rule of study.mandatedProvisions ?? []) {
      text(`${rule.code} (${rule.status === "required" ? tr.elec_status_required : tr.elec_status_info})`, 11, true);
      text(rule.requirement); text(rule.reference);
    }
    if (!study.mandatedProvisions?.length) text(tr.project_electrical_rules_empty);
    section(tr.elec_panel_schedule);
    (study.loadTable ?? []).forEach(row => text(`${row.description}: ${row.connectedVa} VA / ${row.demandedVa} VA (${tr.elec_col_demand_factor}: ${row.demandFactor})${row.phase ? ` (${row.phase})` : ""}`));
    if (study.phaseBalance?.length) { section(tr.elec_phase_balance); study.phaseBalance.forEach(phase => text(`${phase.phase}: ${phase.va} VA`)); }
    section(tr.elec_references); list(study.references);
    section(tr.elec_assumptions); list(study.assumptions);
    text(study.disclaimer || tr.elec_disclaimer_note);
  }
  text(tr.disclaimer);
  if (study) {
    const topology = project.electrical?.topology?.nodes.length ? project.electrical.topology : study.topology;
    if (topology?.nodes.length) {
      const flow = topologyToFlow(topology);
      const diagram = diagramSvg(flow.nodes, flow.edges, tr.elec_diagram_preliminary, { conductors: tr.elec_conductors, conduit: tr.elec_conduit,
        feederLength: tr.elec_feeder_length, protection: tr.elec_protection, interruptingRating: tr.elec_interrupting_rating,
        grounding: tr.elec_grounding, pending: tr.elec_pending_validation, title: tr.elec_single_line });
      const { svg2pdf } = await import("svg2pdf.js");
      pdf.addPage("a3", "landscape");
      const svg = new DOMParser().parseFromString(diagram.source, "image/svg+xml").documentElement;
      const scale = Math.min((pdf.internal.pageSize.getWidth() - margin * 2) / diagram.width, (pdf.internal.pageSize.getHeight() - margin * 2) / diagram.height);
      await svg2pdf(svg, pdf, { x: (pdf.internal.pageSize.getWidth() - diagram.width * scale) / 2, y: margin, width: diagram.width * scale, height: diagram.height * scale });
    }
  }
  for (let index = 1; index <= pdf.getNumberOfPages(); index++) {
    pdf.setPage(index); pdf.setFontSize(8);
    pdf.text(`${index} / ${pdf.getNumberOfPages()}`, margin, pdf.internal.pageSize.getHeight() - 8);
  }
  return pdf;
}
