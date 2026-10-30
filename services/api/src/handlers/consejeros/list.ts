import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { authenticate, AuthError } from "../../middleware/auth";
import { requiere } from "../../middleware/rbac";
import { withTenantContext } from "../../db/client";
import { ok, fail } from "../../utils/response";

/**
 * GET /consejeros?municipio=&estado=&q= — HU-A7.
 * El alcance real NO se aplica aquí con un `if`: lo aplican las políticas de
 * Row-Level Security de schema.sql a partir del contexto de tenant fijado en
 * withTenantContext. Un Coordinador Municipal recibe automáticamente solo los
 * registros de su propio municipio, aunque la consulta no filtre por él.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const user = await authenticate(event);
    requiere(user, "consejero:listar");

    const qs = event.queryStringParameters ?? {};
    const municipioFiltro = qs.municipio;
    const textoBusqueda = qs.q;

    const consejeros = await withTenantContext(
      { rolPlataforma: user.rolPlataforma, municipio: user.municipio },
      async (client) => {
        const condiciones: string[] = [];
        const params: unknown[] = [];

        if (municipioFiltro) {
          params.push(municipioFiltro);
          condiciones.push(`municipio = $${params.length}`);
        }
        if (textoBusqueda) {
          params.push(`%${textoBusqueda}%`);
          condiciones.push(`(nombres ILIKE $${params.length} OR apellidos ILIKE $${params.length})`);
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
