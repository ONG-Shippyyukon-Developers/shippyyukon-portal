import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ConsejeroInput } from "@shippiyyukon/shared";
import { authenticate, AuthError } from "../../middleware/auth";
import { requiere, requiereAlcanceMunicipio } from "../../middleware/rbac";
import { validateConsejeroInput, ValidationError } from "../../domain/consejero";
import { withTenantContext } from "../../db/client";
import { ok, fail } from "../../utils/response";

/**
 * POST /consejeros — HU-A1/A2/A3.
 * El registro queda con estado_registro = PENDIENTE y codigo_unico = NULL;
 * el código se genera recién en HU-A6 (approve.ts), tras la aprobación.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const user = await authenticate(event);
    requiere(user, "consejero:crear");

    const input = JSON.parse(event.body ?? "{}") as ConsejeroInput;
    validateConsejeroInput(input);
    requiereAlcanceMunicipio(user, input.municipio);

    const consejero = await withTenantContext(
      { rolPlataforma: user.rolPlataforma, municipio: input.municipio },
      async (client) => {
        const { rows } = await client.query(
          `INSERT INTO consejeros
             (nombres, apellidos, rol, sub_estado_suplencia, numero_resolucion,
              fecha_ingreso, via_ingreso, estado, municipio, genero,
              cedula_ultimos_2, telefono, correo, creado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING id, estado_registro, fecha_creacion`,
          [
            input.nombres,
            input.apellidos,
            input.rol,
            input.subEstadoSuplencia ?? null,
            input.numeroResolucion,
            input.fechaIngreso,
            input.viaIngreso,
            input.estado,
            input.municipio,
            input.genero,
            input.cedulaUltimos2,
            input.telefono ?? null,
            input.correo ?? null,
            user.sub,
          ]
        );
        return rows[0];
      }
    );

    return ok(consejero, 201);
  } catch (err) {
    if (err instanceof ValidationError) return fail(err.message, 422, "VALIDATION_ERROR");
    if (err instanceof AuthError) return fail(err.message, err.statusCode, "AUTH_ERROR");
    console.error(err);
    return fail("Error interno al registrar el consejero", 500, "INTERNAL_ERROR");
  }
}
