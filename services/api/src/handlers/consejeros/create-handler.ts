import type { ConsejeroInput } from "@shippiyyukon/shared";
import { AuthError, type AuthenticatedUser } from "../../middleware/auth-model";
import { requiere, requiereAlcanceTerritorio } from "../../middleware/rbac";
import { validateConsejeroInput, ValidationError } from "../../domain/consejero";
import { withTenantContext } from "../../db/client";
import { fail, ok } from "../../utils/response";
import type { HttpRequest, HttpResponse } from "../../http/types";

/**
 * POST /consejeros — HU-A1/A2/A3.
 * The registration remains PENDIENTE until an authorized approval.
 */
export async function handleCreate(
  request: HttpRequest,
  user: AuthenticatedUser
): Promise<HttpResponse> {
  try {
    requiere(user, "consejero:crear");

    const input = JSON.parse(request.body ?? "{}") as ConsejeroInput;
    validateConsejeroInput(input);
    requiereAlcanceTerritorio(user, {
      estado: input.estado,
      municipio: input.municipio,
    });
    const alcance = user.alcanceTerritorial;
    if (!alcance) {
      throw new AuthError(
        "El usuario no tiene una asignación de alcance territorial explícita",
        403
      );
    }

    const consejero = await withTenantContext(
      { authenticatedUserId: user.sub, alcanceTerritorial: alcance },
      async (client) => {
        let territoryId: string;
        if (alcance.kind === "MUNICIPAL") {
          territoryId = alcance.territoryId;
        } else {
          const { rows: territories } = await client.query<{ id: string }>(
            `SELECT id
               FROM territories
              WHERE estado = $1
                AND municipio = $2
                AND activo = TRUE`,
            [input.estado, input.municipio]
          );
          if (territories.length !== 1) {
            throw new ValidationError(
              ["La relación estado y municipio no existe en el catálogo territorial"]
            );
          }
          territoryId = territories[0].id;
        }

        const { rows } = await client.query(
          `INSERT INTO consejeros
             (nombres, apellidos, rol, sub_estado_suplencia, numero_resolucion,
              fecha_ingreso, via_ingreso, estado, municipio, territorio_id, genero,
              cedula_ultimos_2, telefono, correo, creado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
            territoryId,
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
    if (err instanceof ValidationError) {
      return fail(err.message, 422, "VALIDATION_ERROR");
    }
    if (err instanceof AuthError) {
      return fail(err.message, err.statusCode, "AUTH_ERROR");
    }
    console.error(err);
    return fail("Error interno al registrar el consejero", 500, "INTERNAL_ERROR");
  }
}
