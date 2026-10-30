import { describe, it, expect } from "vitest";
import { generarCodigoUnico } from "./codeGenerator";

describe("generarCodigoUnico (HU-A5)", () => {
  it("compone iniciales + estado + municipio + género + correlativo con padding", () => {
    const codigo = generarCodigoUnico({
      nombres: "José",
      apellidos: "Pérez",
      estado: "Anzoátegui",
      municipio: "Cantaura",
      genero: "M",
      correlativo: 14,
    });
    expect(codigo).toBe("JP-ANZ-CAN-M-014");
  });

  it("nunca incluye dígitos de cédula en el código (Riesgo 5)", () => {
    // generarCodigoUnico ni siquiera acepta cédula como parámetro: a nivel de
    // tipos es imposible pasarla por error. El código resultante tiene
    // exactamente 5 segmentos (iniciales, estado, municipio, género, correlativo).
    const codigo = generarCodigoUnico({
      nombres: "Ana",
      apellidos: "Gómez",
      estado: "Sucre",
      municipio: "Cumaná",
      genero: "F",
      correlativo: 1,
    });
    expect(codigo.split("-")).toHaveLength(5);
    expect(codigo).toBe("AG-SUC-CUM-F-001");
  });

  it("rellena el correlativo a 3 dígitos", () => {
    const codigo = generarCodigoUnico({
      nombres: "Luis",
      apellidos: "Rondón",
      estado: "Anzoátegui",
      municipio: "Cantaura",
      genero: "M",
      correlativo: 3,
    });
    expect(codigo.endsWith("-003")).toBe(true);
  });
});
