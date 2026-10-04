import { evaluatorRequest } from "@/lib/evaluatorRequest";
import { BuildingType } from "@/services/sokolApi";

it("fills explicit Spanish request values without inventing missing details", () => {
  expect(evaluatorRequest({ user_query: "Evalúa un restaurante de 350 m², 2 pisos, 120 personas, altura de techo 3,5 m y 1225 m³." })).toMatchObject({
    building_type: BuildingType.comercial, usage: "restaurante", area_m2: 350, floors: 2, occupants: 120, ceiling_height_m: 3.5, volume_m3: 1225,
  });
  expect(evaluatorRequest({ user_query: "Evaluate my building using NFPA 13 and NFPA 72." }).area_m2).toBeUndefined();
  expect(evaluatorRequest({ user_query: "Evaluate my building." }).building_type).toBeUndefined();
});

it("carries English values while retaining structured inputs and explicit corrections", () => {
  expect(evaluatorRequest({ user_query: "Evaluate this home: 120 m2, 2 floors, 6 people.", usage: "Family home", area_m2: 90, ceiling_height_m: 3 })).toMatchObject({
    building_type: BuildingType.residencial, usage: "Family home", area_m2: 120, floors: 2, occupants: 6, ceiling_height_m: 3,
  });
});

it("uses the latest explicit quantities, including labeled clarification answers", () => {
  expect(evaluatorRequest({ user_query: "Evalúa un restaurante de 350 m².\nÁrea (m²): 500\nPisos: 3\nOcupantes: 90" })).toMatchObject({ area_m2: 500, floors: 3, occupants: 90 });
});
