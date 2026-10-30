/**
 * Tipos de dominio compartidos entre apps/web y services/api.
 * Fuente de verdad: RawData Técnico-Legal §7 (Diccionario de Datos) y PRD §5 (Épica A).
 */

/** RawData §6 Módulo A — 5 categorías obligatorias del campo "Rol" */
export enum RolConsejero {
  COORDINADOR_NACIONAL = "COORDINADOR_NACIONAL",
  COORDINADOR_ESTADAL = "COORDINADOR_ESTADAL",
  COORDINADOR_MUNICIPAL = "COORDINADOR_MUNICIPAL",
  CONSEJERO_PRINCIPAL = "CONSEJERO_PRINCIPAL",
  CONSEJERO_SUPLENTE = "CONSEJERO_SUPLENTE",
}

/** Solo aplica cuando rol === CONSEJERO_SUPLENTE (HU-A2) */
export enum SubEstadoSuplencia {
  PERMANENTE_FIJO = "PERMANENTE_FIJO",
  SUPLENCIA_TEMPORAL = "SUPLENCIA_TEMPORAL",
  LISTADO_SUPLENTE = "LISTADO_SUPLENTE",
}

/** RawData §6 Módulo A — vía de ingreso del consejero (valida el origen de sus funciones) */
export enum ViaIngreso {
  CONCURSO_OPOSICION = "CONCURSO_OPOSICION",
  DESIGNACION_DIRECTA = "DESIGNACION_DIRECTA",
}

/** HU-A6 — flujo "Carga Autorizada": Coordinador Municipal carga, Shippiyyukon/CAIRUS aprueba */
export enum EstadoRegistro {
  PENDIENTE = "PENDIENTE",
  APROBADO = "APROBADO",
  RECHAZADO = "RECHAZADO",
}

/**
 * RBAC — RawData §11 (actualizado 24/10/2026: gobernanza Master → Comité
 * Nacional → Coordinador Nacional → Estadal → Municipal). Roles de
 * plataforma, distintos del Rol jerárquico del consejero (RolConsejero).
 */
export enum RolPlataforma {
  MASTER = "MASTER", // antes "Super Administrador" — acceso y gestión total
  COMITE_NACIONAL = "COMITE_NACIONAL", // paneles compartidos con Master; permisos por espacio delegados
  COORDINADOR_NACIONAL = "COORDINADOR_NACIONAL",
  COORDINADOR_ESTADAL = "COORDINADOR_ESTADAL",
  COORDINADOR_MUNICIPAL = "COORDINADOR_MUNICIPAL",
  CONSEJERO = "CONSEJERO",
  VALIDADOR_TERRENO = "VALIDADOR_TERRENO",
  AUDITOR = "AUDITOR",
}

export interface ConsejeroInput {
  nombres: string;
  apellidos: string;
  rol: RolConsejero;
  subEstadoSuplencia?: SubEstadoSuplencia; // obligatorio si rol === CONSEJERO_SUPLENTE (HU-A2)
  numeroResolucion: string; // HU-A3, alfanumérico
  fechaIngreso: string; // ISO date, HU-A3
  viaIngreso: ViaIngreso; // HU-A3
  estado: string; // estado venezolano (ej. "Anzoátegui")
  municipio: string; // determina el tenant / esquema (RawData §5 Riesgo 3)
  genero: "M" | "F";
  cedulaUltimos2: string; // solo para generación interna del código (HU-A5) — nunca se expone completo
  telefono?: string;
  correo?: string;
}

export interface Consejero extends ConsejeroInput {
  id: string;
  codigoUnico: string | null; // null hasta la aprobación (HU-A5, HU-A6)
  aniosServicio: number; // calculado (HU-A4)
  estadoRegistro: EstadoRegistro;
  creadoPor: string; // id del Coordinador Municipal que cargó el registro
  aprobadoPor?: string;
  fechaCreacion: string;
  fechaAprobacion?: string;
}

/** Forma de la respuesta estándar de la API (services/api/src/utils/response.ts) */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
