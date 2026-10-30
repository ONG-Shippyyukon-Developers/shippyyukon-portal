import {
  ConsejeroInput,
  RolConsejero,
  SubEstadoSuplencia,
} from "@shippiyyukon/shared";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "ValidationError";
  }
}

/**
 * HU-A1 / HU-A2 / HU-A3 — valida el payload de alta de un consejero
 * antes de persistirlo. No guarda nada: solo valida.
 */
export function validateConsejeroInput(input: ConsejeroInput): void {
  const issues: string[] = [];

  if (!input.nombres?.trim()) issues.push("nombres es obligatorio");
  if (!input.apellidos?.trim()) issues.push("apellidos es obligatorio");

  if (!Object.values(RolConsejero).includes(input.rol)) {
    issues.push("rol debe ser uno de los 5 valores definidos en RawData §6 Módulo A");
  }

  // HU-A2 — sub-estado de suplencia obligatorio SOLO si el rol es Consejero Suplente
  if (input.rol === RolConsejero.CONSEJERO_SUPLENTE) {
    if (!input.subEstadoSuplencia) {
      issues.push(
        "subEstadoSuplencia es obligatorio cuando rol = CONSEJERO_SUPLENTE (HU-A2)"
      );
    }
  } else if (input.subEstadoSuplencia) {
    issues.push(
      "subEstadoSuplencia solo aplica cuando rol = CONSEJERO_SUPLENTE (HU-A2)"
    );
  }
  if (
    input.subEstadoSuplencia &&
    !Object.values(SubEstadoSuplencia).includes(input.subEstadoSuplencia)
  ) {
    issues.push("subEstadoSuplencia inválido");
  }

  // HU-A3 — datos de nombramiento
  if (!input.numeroResolucion?.trim()) {
    issues.push("numeroResolucion es obligatorio (HU-A3)");
  }
  if (!input.fechaIngreso || Number.isNaN(Date.parse(input.fechaIngreso))) {
    issues.push("fechaIngreso debe ser una fecha ISO válida (HU-A3)");
  }
  if (!input.viaIngreso) {
    issues.push("viaIngreso es obligatorio (concurso de oposición o designación directa — HU-A3)");
  }

  if (!input.estado?.trim()) issues.push("estado es obligatorio");
  if (!input.municipio?.trim()) {
    issues.push("municipio es obligatorio (determina el tenant — RawData Riesgo 3)");
  }
  if (input.genero !== "M" && input.genero !== "F") {
    issues.push("genero debe ser 'M' o 'F'");
  }
  if (!/^\d{2}$/.test(input.cedulaUltimos2 ?? "")) {
    issues.push(
      "cedulaUltimos2 debe ser exactamente 2 dígitos — solo se usa internamente para el código (Riesgo 5)"
    );
  }

  if (issues.length > 0) throw new ValidationError(issues);
}

/**
 * HU-A4 — años de servicio calculados dinámicamente a partir de fechaIngreso.
 * Se calcula al vuelo (no se persiste como valor fijo) para que siempre esté
 * actualizado, tal como pide la historia de usuario.
 */
export function calcularAniosServicio(fechaIngresoISO: string, hoy: Date = new Date()): number {
  const ingreso = new Date(fechaIngresoISO);
  let anios = hoy.getFullYear() - ingreso.getFullYear();
  const aunNoCumpleAniversario =
    hoy.getMonth() < ingreso.getMonth() ||
    (hoy.getMonth() === ingreso.getMonth() && hoy.getDate() < ingreso.getDate());
  if (aunNoCumpleAniversario) anios -= 1;
  return Math.max(anios, 0);
}
