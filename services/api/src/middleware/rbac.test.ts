import { describe, expect, it } from "vitest";
import { RolPlataforma } from "@shippiyyukon/shared";
import {
  requiere,
  requiereAlcanceTerritorio,
  requiereCtoDevPrincipal,
} from "./rbac";
import { AuthError } from "./auth-model";

describe("RBAC — CTO_DEV", () => {
  const ctoDev = {
    sub: "test-cto-dev",
    rolPlataforma: "CTO_DEV" as RolPlataforma,
    alcanceTerritorial: { kind: "GLOBAL" as const },
  };

  it("permite a CTO_DEV crear consejeros", () => {
    expect(() => requiere(ctoDev, "consejero:crear")).not.toThrow();
  });

  it("permite a CTO_DEV aprobar consejeros", () => {
    expect(() => requiere(ctoDev, "consejero:aprobar")).not.toThrow();
  });

  it("permite a CTO_DEV listar consejeros", () => {
    expect(() => requiere(ctoDev, "consejero:listar")).not.toThrow();
  });

  it("permite a CTO_DEV cualquier acción protegida por el guard", () => {
    expect(() => requiere(ctoDev, "administrar:roles")).not.toThrow();
  });

  it("permite solo al CTO/DEV principal administrar al segundo CTO", () => {
    expect(() =>
      requiereCtoDevPrincipal({
        ...ctoDev,
        ctoDevPosition: "PRIMARY",
      })
    ).not.toThrow();
    expect(() =>
      requiereCtoDevPrincipal({
        ...ctoDev,
        ctoDevPosition: "SECONDARY",
      })
    ).toThrow(AuthError);
  });
});

describe("RBAC — permisos explícitos y alcance", () => {
  const master = {
    sub: "test-master",
    rolPlataforma: RolPlataforma.MASTER,
    alcanceTerritorial: { kind: "GLOBAL" as const },
  };
  const consejero = {
    sub: "test-consejero",
    rolPlataforma: RolPlataforma.CONSEJERO,
    alcanceTerritorial: { kind: "GLOBAL" as const },
  };
  const coordinadorMunicipal = {
    sub: "test-coordinador",
    rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
    municipio: "Municipio A",
    alcanceTerritorial: {
      kind: "MUNICIPAL" as const,
      territoryId: "11111111-1111-4111-8111-111111111111",
      estado: "Estado 1",
      municipio: "Municipio A",
    },
  };

  it("mantiene los permisos actuales de MASTER explícitos", () => {
    expect(() => requiere(master, "consejero:crear")).not.toThrow();
    expect(() => requiere(master, "consejero:aprobar")).not.toThrow();
    expect(() => requiere(master, "consejero:listar")).not.toThrow();
  });

  it("deniega por defecto acciones de consejero a CONSEJERO", () => {
    expect(() => requiere(consejero, "consejero:crear")).toThrow();
    expect(() => requiere(consejero, "consejero:aprobar")).toThrow();
    expect(() => requiere(consejero, "consejero:listar")).toThrow();
  });

  it("limita al coordinador municipal al estado y municipio asignados", () => {
    expect(() =>
      requiereAlcanceTerritorio(coordinadorMunicipal, {
        estado: "Estado 1",
        municipio: "Municipio A",
      })
    ).not.toThrow();
    expect(() =>
      requiereAlcanceTerritorio(coordinadorMunicipal, {
        estado: "Estado 1",
        municipio: "Municipio B",
      })
    ).toThrow();
    expect(() =>
      requiereAlcanceTerritorio(coordinadorMunicipal, {
        estado: "Estado 2",
        municipio: "Municipio A",
      })
    ).toThrow();
  });

  it("usa alcance GLOBAL explícito incluso si el rol no es nacional", () => {
    const coordinadorGlobal = {
      sub: "test-coordinador-global",
      rolPlataforma: RolPlataforma.COORDINADOR_MUNICIPAL,
      alcanceTerritorial: { kind: "GLOBAL" as const },
    };

    expect(() =>
      requiereAlcanceTerritorio(coordinadorGlobal, {
        estado: "Estado 1",
        municipio: "Municipio B",
      })
    ).not.toThrow();
  });

  it("no amplía a global el alcance MUNICIPAL de un rol elevado", () => {
    const masterMunicipal = {
      sub: "test-master-municipal",
      rolPlataforma: RolPlataforma.MASTER,
      alcanceTerritorial: {
        kind: "MUNICIPAL" as const,
        territoryId: "11111111-1111-4111-8111-111111111111",
        estado: "Estado 1",
        municipio: "Municipio A",
      },
    };

    expect(() =>
      requiereAlcanceTerritorio(masterMunicipal, {
        estado: "Estado 1",
        municipio: "Municipio A",
      })
    ).not.toThrow();
    expect(() =>
      requiereAlcanceTerritorio(masterMunicipal, {
        estado: "Estado 1",
        municipio: "Municipio B",
      })
    ).toThrow(AuthError);
  });
});

describe("RBAC — alcance territorial de CTO_DEV", () => {
  const ctoDevMunicipioA = {
    sub: "test-cto-dev-municipio-a",
    rolPlataforma: RolPlataforma.CTO_DEV,
    alcanceTerritorial: {
      kind: "MUNICIPAL" as const,
      territoryId: "11111111-1111-4111-8111-111111111111",
      estado: "Estado 1",
      municipio: "Municipio A",
    },
  };

  it("rechaza asignaciones CTO/DEV sin alcance GLOBAL explícito", () => {
    expect(() =>
      requiereAlcanceTerritorio(ctoDevMunicipioA, {
        estado: "Estado 1",
        municipio: "Municipio A",
      })
    ).toThrow("La asignación CTO/DEV requiere alcance GLOBAL explícito");
  });
});
