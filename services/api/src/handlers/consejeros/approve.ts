import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { authenticate, AuthError } from "../../middleware/auth";
import { requiere } from "../../middleware/rbac";
import { generarCodigoUnico } from "../../domain/codeGenerator";
import { withTenantContext, siguienteCorrelativo } from "../../db/client";
import { ok, fail } from "../../utils/response";

interface AprobarBody {
  decision: "APROBADO" | "RECHAZADO";
}

/**
 * POST /consejeros/{id}/approve — HU-A6 ("Carga Autorizada").
 * Solo roles nacionales (Shippiyyukon/CAIRUS) pueden aprobar o rechazar.
 * Al aprobar, genera el código único (HU-A5) de forma atómica.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const user = await authenticate(event);
    requiere(user, "consejero:aprobar");

    const id = event.pathParameters?.id;
    if (!id) return fail("Falta el id del consejero en la ruta", 400);

    const { decision } = JSON.parse(event.body ?? "{}") as AprobarBody;
    if (decision !== "APROBADO" && decision !== "RECHAZADO") {
      return fail("decision debe ser APROBADO o RECHAZADO", 422);
    }

    const resultado = await withTenantContext(
      { rolPlataforma: user.rolPlataforma }, // roles nacionales: sin restricción de municipio
      async (client) => {
        const { rows: pendientes } = await client.query(
          `SELECT id, nombres, apellidos, estado, municipio, genero, estado_registro
             FROM consejeros WHERE id = $1`,
          [id]
        );
        const consejero = pendientes[0];
        if (!consejero) return null;
        if (consejero.estado_registro !== "PENDIENTE") {
          throw new Error(`El registro ya está en estado ${consejero.estado_registro}`);
        }

        if (decision === "RECHAZADO") {
          const { rows } = await client.query(
            `UPDATE consejeros
               SET estado_registro = 'RECHAZADO', aprobado_por = $2
             WHERE id = $1
             RETURNING id, estado_registro`,
            [id, user.sub]
          );
          return rows[0];
        }

        // APROBADO: genera el correlativo atómico del municipio y el código único (HU-A5)
        const correlativo = await siguienteCorrelativo(client, consejero.municipio);
        const codigoUnico = generarCodigoUnico({
          nombres: consejero.nombres,
          apellidos: consejero.apellidos,
          estado: consejero.estado,
          municipio: consejero.municipio,
          genero: consejero.genero,
          correlativo,
        });

        const { rows } = await client.query(
          `UPDATE consejeros
             SET estado_registro = 'APROBADO',
                 codigo_unico = $2,
                 aprobado_por = $3,
                 fecha_aprobacion = now()
           WHERE id = $1
           RETURNING id, estado_registro, codigo_unico, fecha_aprobacion`,
          [id, codigoUnico, user.sub]
        );
        return rows[0];
      }
    );

    if (!resultado) return fail("Consejero no encontrado", 404, "NOT_FOUND");
    return ok(resultado);
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.statusCode, "AUTH_ERROR");
    console.error(err);
    return fail((err as Error).message ?? "Error interno al aprobar el registro", 500);
  }
}
