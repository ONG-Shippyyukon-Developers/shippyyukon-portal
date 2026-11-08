import { AuthError, type AuthenticatedUser } from "../../middleware/auth-model";
import { requiere } from "../../middleware/rbac";
import { withTenantContext } from "../../db/client";
import { fail, ok } from "../../utils/response";
import type { HttpRequest, HttpResponse } from "../../http/types";

/**
 * GET /consejeros?municipio=&estado=&q= — HU-A7.
 * The authenticated identity is supplied by the runtime-specific adapter;
 * explicit municipal scope is always applied as a query predicate. PostgreSQL
 * The assigned territory UUID is an explicit filter in addition to RLS.
 */
export async function handleList(
  request: HttpRequest,
  user: AuthenticatedUser
): Promise<HttpResponse> {
  try {
    requiere(user, "consejero:listar");

    const estadoFiltro = request.query?.estado;
    const municipioFiltro = request.query?.municipio;
    const textoBusqueda = request.query?.q;
    const alcance = user.alcanceTerritorial;
    if (!alcance) {
      throw new AuthError(
        "El usuario no tiene una asignación de alcance territorial explícita",
        403
      );
    }
    if (
      alcance.kind === "MUNICIPAL" &&
      ((municipioFiltro && municipioFiltro !== alcance.municipio) ||
        (estadoFiltro && estadoFiltro !== alcance.estado))
    ) {
      throw new AuthError(
        "Este registro pertenece a otro territorio, fuera de tu alcance",
        403
      );
    }

    const consejeros = await withTenantContext(
      {
        authenticatedUserId: user.sub,
        alcanceTerritorial: alcance,
      },
      async (client) => {
        const condiciones: string[] = [];
        const params: unknown[] = [];

        if (alcance.kind === "MUNICIPAL") {
          params.push(alcance.territoryId);
          condiciones.push(`territorio_id = $${params.length}`);
        }
        if (estadoFiltro) {
          params.push(estadoFiltro);
          condiciones.push(`estado = $${params.length}`);
        }
        if (municipioFiltro) {
          params.push(municipioFiltro);
          condiciones.push(`municipio = $${params.length}`);
        }
        if (textoBusqueda) {
          params.push(`%${textoBusqueda}%`);
          condiciones.push(
            `(nombres ILIKE $${params.length} OR apellidos ILIKE $${params.length})`
          );
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
        const { rows } = await client.query(
          `SELECT id, nombres, apellidos, rol, sub_estado_suplencia, estado,
                  municipio, codigo_unico, estado_registro, fecha_creacion
             FROM consejeros
             ${where}
             ORDER BY fecha_creacion DESC
             LIMIT 100`,
          params
        );
        return rows;
      }
    );

    return ok(consejeros);
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.statusCode, "AUTH_ERROR");
    console.error(err);
    return fail("Error interno al listar consejeros", 500);
  }
}
