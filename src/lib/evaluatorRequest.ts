import { BuildingType, type EvaluateRequest } from "@/services/sokolApi";

/** Carry explicit user-provided building details into the evaluator filters. */
export function evaluatorRequest(request: EvaluateRequest): EvaluateRequest {
  const text = request.user_query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const value = (...patterns: RegExp[]) => {
    const match = patterns.flatMap(pattern => [...text.matchAll(new RegExp(pattern.source, "gu"))])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).at(-1);
    if (!match) return undefined;
    const parsed = Number(match[1].replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const area = value(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\^2|metros cuadrados|square meters|square metres)/u,
    /\barea(?:\s+(?:total|aproximada))?(?:\s*\(m[²2]\))?\s*[:=]\s*(\d+(?:[.,]\d+)?)/);
  const floors = value(/(\d+)\s*(?:pisos?|plantas?|floors?|stories|storeys)\b/,
    /\b(?:pisos?|plantas?|floors?|stories|storeys)\s*[:=]\s*(\d+)/);
  const occupants = value(/(\d+)\s*(?:personas?|ocupantes?|occupants?|people|persons?)\b/,
    /\b(?:personas?|ocupantes?|occupants?|people)\s*[:=]\s*(\d+)/);
  const ceiling = value(/(?:altura(?:\s+(?:de(?:l)?\s+)?(?:techo|cielo raso))?|ceiling(?:\s+height)?)\s*(?:de|of|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(?:m\b|metros?\b|meters?\b|metres?\b)/);
  const volume = value(/(\d+(?:[.,]\d+)?)\s*(?:m³|m3|m\^3|metros cubicos|cubic meters|cubic metres)/);
  const usage = text.match(/\b(restaurante|restaurant|bodega|warehouse|vivienda|casa|home|house|apartamento|apartment|oficina|office|local comercial|commercial premises|fabrica|factory)\b/)?.[1];
  const building = /\b(industrial|fabrica|factory)\b/.test(text) ? BuildingType.industrial
    : /\b(residencial|residential|vivienda|casa|home|house|apartamento|apartment)\b/.test(text) ? BuildingType.residencial
    : /\b(comercial|commercial|restaurante|restaurant|oficina|office)\b/.test(text) ? BuildingType.comercial
    : undefined;
  return {
    ...request,
    building_type: building ?? request.building_type,
    usage: request.usage || usage,
    area_m2: area ?? request.area_m2,
    floors: floors ?? request.floors,
    occupants: occupants ?? request.occupants,
    ceiling_height_m: ceiling ?? request.ceiling_height_m,
    volume_m3: volume ?? request.volume_m3,
  };
}
