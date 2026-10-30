import { RolPlataforma } from "@shippiyyukon/shared";
import { AuthenticatedUser, AuthError } from "./auth";

/**
 * HU-00.5 — matriz de permisos mínimos por rol (RawData §11).
 * Cada acción de la Épica A se mapea aquí explícitamente; una acción no
 * listada para un rol queda denegada por defecto (whitelist, no blacklist).
 */
const PERMISOS: Record<string, RolPlataforma[]> = {
  "consejero:crear": [
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
    RolPlataforma.COORDINADOR_ESTADAL,
    RolPlataforma.COORDINADOR_MUNICIPAL,
  ],
  "consejero:aprobar": [
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
  ],
  "consejero:listar": [
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
    RolPlataforma.COORDINADOR_ESTADAL,
    RolPlataforma.COORDINADOR_MUNICIPAL,
    RolPlataforma.AUDITOR,
  ],
};

export function requiere(user: AuthenticatedUser, accion: keyof typeof PERMISOS): void {
  const permitidos = PERMISOS[accion];
  if (!permitidos?.includes(user.rolPlataforma)) {
    throw new AuthError(
      `El rol ${user.rolPlataforma} no tiene permiso para '${accion}'`,
      403
    );
  }
}

/** HU-A7 — un Coordinador Municipal/Estadal solo gestiona su propio alcance territorial. */
export function requiereAlcanceMunicipio(
  user: AuthenticatedUser,
  municipioObjetivo: string
): void {
  const rolesNacionales = [
    RolPlataforma.MASTER,
    RolPlataforma.COMITE_NACIONAL,
    RolPlataforma.COORDINADOR_NACIONAL,
    RolPlataforma.AUDITOR,
  ];
  if (rolesNacionales.includes(user.rolPlataforma)) return;
  if (user.municipio !== municipioObjetivo) {
    throw new AuthError(
      "Este registro pertenece a otro municipio, fuera de tu alcance (RawData §11)",
      403
    );
  }
}
