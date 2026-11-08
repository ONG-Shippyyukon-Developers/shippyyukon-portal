import {
  RolPlataforma,
  type AccionPlataforma,
} from "@shippiyyukon/shared";
import { AuthError } from "./auth-model";
import type { AuthenticatedUser } from "./auth-model";

/**
 * HU-00.5 — matriz de permisos mínimos por rol (RawData §11).
 * Cada acción de la Épica A se mapea aquí explícitamente; una acción no
 * listada para un rol queda denegada por defecto (whitelist, no blacklist).
 */
type RbacAction = AccionPlataforma;

const PERMISOS: Record<RbacAction, RolPlataforma[]> = {
  "consejero:crear": [
    RolPlataforma.CTO_DEV,
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
    RolPlataforma.COORDINADOR_ESTADAL,
    RolPlataforma.COORDINADOR_MUNICIPAL,
  ],
  "consejero:aprobar": [
    RolPlataforma.CTO_DEV,
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
  ],
  "consejero:listar": [
    RolPlataforma.CTO_DEV,
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
    RolPlataforma.COORDINADOR_ESTADAL,
    RolPlataforma.COORDINADOR_MUNICIPAL,
    RolPlataforma.AUDITOR,
  ],
};

function esAccionRbac(accion: string): accion is RbacAction {
  return Object.prototype.hasOwnProperty.call(PERMISOS, accion);
}

export function requiere(user: AuthenticatedUser, accion: string): void {
  if (user.rolPlataforma === RolPlataforma.CTO_DEV) return;
  if (!esAccionRbac(accion) || !PERMISOS[accion].includes(user.rolPlataforma)) {
    throw new AuthError(
      `El rol ${user.rolPlataforma} no tiene permiso para '${accion}'`,
      403
    );
  }
}

export function permisosPara(user: AuthenticatedUser): AccionPlataforma[] {
  return Object.keys(PERMISOS)
    .filter(esAccionRbac)
    .filter(
      (action) =>
        user.rolPlataforma === RolPlataforma.CTO_DEV ||
        PERMISOS[action].includes(user.rolPlataforma)
    );
}

export function requiereCtoDevPrincipal(user: AuthenticatedUser): void {
  if (
    user.rolPlataforma !== RolPlataforma.CTO_DEV ||
    user.ctoDevPosition !== "PRIMARY" ||
    user.alcanceTerritorial.kind !== "GLOBAL"
  ) {
    throw new AuthError(
      "Solo el CTO/DEV principal puede administrar el segundo CTO/DEV",
      403
    );
  }
}

/** Enforces the territorial scope granted by the active authorization assignment. */
export function requiereAlcanceTerritorio(
  user: AuthenticatedUser,
  territorioObjetivo: { estado: string; municipio: string }
): void {
  const alcance = user.alcanceTerritorial;
  if (!alcance) {
    throw new AuthError(
      "El usuario no tiene una asignación de alcance territorial explícita",
      403
    );
  }
  if (
    user.rolPlataforma === RolPlataforma.CTO_DEV &&
    alcance.kind !== "GLOBAL"
  ) {
    throw new AuthError(
      "La asignación CTO/DEV requiere alcance GLOBAL explícito",
      403
    );
  }
  if (alcance.kind === "GLOBAL") return;
  if (
    alcance.estado !== territorioObjetivo.estado ||
    alcance.municipio !== territorioObjetivo.municipio
  ) {
    throw new AuthError(
      "Este registro pertenece a otro territorio, fuera de tu alcance",
      403
    );
  }
}
