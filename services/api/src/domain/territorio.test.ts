import { describe, it, expect } from "vitest";
import {
  esRelacionTerritorialValida,
  obtenerMunicipiosPorEstado,
} from "./territorio";

describe("modelo territorial mockup", () => {
  it("acepta una relación válida entre estado y municipio", () => {
    expect(
      esRelacionTerritorialValida("Estado 1", "Municipio A")
    ).toBe(true);
  });

  it("rechaza un municipio que no pertenece al estado indicado", () => {
    expect(
      esRelacionTerritorialValida("Estado 1", "Municipio inexistente")
    ).toBe(false);
  });

  it("devuelve únicamente los municipios del estado solicitado", () => {
    expect(obtenerMunicipiosPorEstado("Estado 1")).toEqual([
      "Municipio A",
      "Municipio B",
      "Municipio C",
    ]);
  });

  it("permite que municipios con el mismo nombre existan en estados distintos", () => {
    expect(
      esRelacionTerritorialValida("Estado 1", "Municipio A")
    ).toBe(true);

    expect(
      esRelacionTerritorialValida("Estado 2", "Municipio A")
    ).toBe(true);
  });

  it("rechaza estados inexistentes", () => {
    expect(
      esRelacionTerritorialValida("Estado inexistente", "Municipio A")
    ).toBe(false);
  });
});
