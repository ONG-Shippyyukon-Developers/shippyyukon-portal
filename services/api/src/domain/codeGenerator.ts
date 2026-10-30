/**
 * HU-A5 — Generación del código único de identificación por consejero.
 *
 * RawData, Riesgo 5: los dígitos de cédula son aceptables para uso administrativo
 * INTERNO, pero NO deben formar parte de ningún identificador expuesto públicamente.
 * Por eso el código público se compone solo de: iniciales + abreviatura de
 * estado/municipio + género + correlativo — nunca de la cédula.
 *
 * El correlativo debe asignarse de forma atómica (ver db/schema.sql: secuencia
 * `consejero_correlativo_seq`, una por municipio) para evitar colisiones bajo
 * carga concurrente; esta función es pura y recibe el correlativo ya asignado.
 */

export interface CodigoUnicoInput {
  nombres: string;
  apellidos: string;
  estado: string;
  municipio: string;
  genero: "M" | "F";
  correlativo: number; // asignado atómicamente por la base de datos
}

function inicial(s: string): string {
  const limpio = s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (limpio[0] ?? "X").toUpperCase();
}

/** Abreviatura de 3 letras, determinística, a partir del nombre del estado/municipio. */
function abreviar(s: string, longitud = 3): string {
  const limpio = s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return limpio.slice(0, longitud).padEnd(longitud, "X");
}

export function generarCodigoUnico(input: CodigoUnicoInput): string {
  const iniciales = `${inicial(input.nombres)}${inicial(input.apellidos)}`;
  const estadoAbbr = abreviar(input.estado);
  const municipioAbbr = abreviar(input.municipio);
  const correlativo = String(input.correlativo).padStart(3, "0");
  // Ej: "JP-ANZ-CAN-M-014"
  return `${iniciales}-${estadoAbbr}-${municipioAbbr}-${input.genero}-${correlativo}`;
}
