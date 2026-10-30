import { describe, it, expect } from "vitest";
import { validateConsejeroInput, calcularAniosServicio, ValidationError } from "./consejero";
import { RolConsejero, SubEstadoSuplencia, ViaIngreso, ConsejeroInput } from "@shippiyyukon/shared";

const base: ConsejeroInput = {
  nombres: "Carla",
  apellidos: "Marín",
  rol: RolConsejero.CONSEJERO_PRINCIPAL,
  numeroResolucion: "RES-2026-014",
  fechaIngreso: "2022-03-01",
  viaIngreso: ViaIngreso.CONCURSO_OPOSICION,
  estado: "Anzoátegui",
  municipio: "Cantaura",
  genero: "F",
  cedulaUltimos2: "45",
};

describe("validateConsejeroInput", () => {
  it("acepta un registro completo y válido", () => {
    expect(() => validateConsejeroInput(base)).not.toThrow();
  });

  it("HU-A2 — exige subEstadoSuplencia cuando el rol es CONSEJERO_SUPLENTE", () => {
    expect(() =>
      validateConsejeroInput({ ...base, rol: RolConsejero.CONSEJERO_SUPLENTE })
    ).toThrow(ValidationError);

    expect(() =>
      validateConsejeroInput({
        ...base,
        rol: RolConsejero.CONSEJERO_SUPLENTE,
        subEstadoSuplencia: SubEstadoSuplencia.SUPLENCIA_TEMPORAL,
      })
    ).not.toThrow();
  });

  it("HU-A2 — rechaza subEstadoSuplencia si el rol NO es suplente", () => {
    expect(() =>
      validateConsejeroInput({
        ...base,
        subEstadoSuplencia: SubEstadoSuplencia.LISTADO_SUPLENTE,
      })
    ).toThrow(ValidationError);
  });

  it("exige exactamente 2 dígitos de cédula (uso interno, Riesgo 5)", () => {
    expect(() => validateConsejeroInput({ ...base, cedulaUltimos2: "4" })).toThrow();
    expect(() => validateConsejeroInput({ ...base, cedulaUltimos2: "456" })).toThrow();
  });
});

describe("calcularAniosServicio (HU-A4)", () => {
  it("calcula años completos transcurridos", () => {
    const hoy = new Date("2026-06-15");
    expect(calcularAniosServicio("2022-03-01", hoy)).toBe(4);
  });

  it("no suma el año si aún no se cumple el aniversario", () => {
    const hoy = new Date("2026-01-10");
    expect(calcularAniosServicio("2022-03-01", hoy)).toBe(3);
  });
});
