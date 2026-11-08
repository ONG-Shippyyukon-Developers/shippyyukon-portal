import { AuthError, type AuthenticatedUser } from "../../middleware/auth-model";
import { requiere } from "../../middleware/rbac";
import { generarCodigoUnico } from "../../domain/codeGenerator";
import { withTenantContext, siguienteCorrelativo } from "../../db/client";
import { fail, ok } from "../../utils/response";
import type { HttpRequest, HttpResponse } from "../../http/types";

interface AprobarBody {
  decision: "APROBADO" | "RECHAZADO";
}

class ApprovalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalConflictError";
  }
}

/**
 * POST /consejeros/{id}/approve — HU-A6.
 * The authenticated identity and HTTP request are supplied by the adapter.
 */
export async function handleApprove(
  request: HttpRequest,
  user: AuthenticatedUser
): Promise<HttpResponse> {
  try {
    requiere(user, "consejero:aprobar");

    const id = request.params?.id;
    if (!id) return fail("Falta el id del consejero en la ruta", 400);

    const { decision } = JSON.parse(request.body ?? "{}") as AprobarBody;
    if (decision !== "APROBADO" && decision !== "RECHAZADO") {
      return fail("decision debe ser APROBADO o RECHAZADO", 422);
    }

    const alcance = user.alcanceTerritorial;
    if (!alcance) {
      throw new AuthError(
        "El usuario no tiene una asignación de alcance territorial explícita",
        403
      );
    }

    const resultado = await withTenantContext(
      {
        authenticatedUserId: user.sub,
        alcanceTerritorial: alcance,
      },
      async (client) => {
        const selectScope =
          alcance.kind === "MUNICIPAL" ? " AND territorio_id = $2" : "";
        const selectParams =
          alcance.kind === "MUNICIPAL" ? [id, alcance.territoryId] : [id];
        const { rows: pendientes } = await client.query(
          `SELECT id, nombres, apellidos, estado, municipio, territorio_id,
                  genero, estado_registro
             FROM consejeros
            WHERE id = $1
              ${selectScope}
            FOR UPDATE`,
          selectParams
        );
        const candidate = pendientes[0];
        const consejero =
          candidate &&
          (alcance.kind === "GLOBAL" ||
            candidate.territorio_id === alcance.territoryId)
            ? candidate
            : undefined;
        if (!consejero) return null;
        if (consejero.estado_registro !== "PENDIENTE") {
          throw new ApprovalConflictError(
            `El registro ya está en estado ${consejero.estado_registro}`
          );
        }

        if (decision === "RECHAZADO") {
          const updateScope =
            alcance.kind === "MUNICIPAL" ? " AND territorio_id = $3" : "";
          const updateParams =
            alcance.kind === "MUNICIPAL"
              ? [id, user.sub, alcance.territoryId]
              : [id, user.sub];
          const { rows } = await client.query(
            `UPDATE consejeros
                SET estado_registro = 'RECHAZADO',
                    aprobado_por = $2
              WHERE id = $1
                AND estado_registro = 'PENDIENTE'
                ${updateScope}
             RETURNING id, estado_registro`,
            updateParams
          );
          if (rows.length !== 1) {
            throw new ApprovalConflictError(
              "El registro ya no está pendiente de aprobación"
            );
          }
          return rows[0];
        }

        const correlativo = await siguienteCorrelativo(
          client,
          consejero.territorio_id
        );
        const codigoUnico = generarCodigoUnico({
          nombres: consejero.nombres,
          apellidos: consejero.apellidos,
          estado: consejero.estado,
          municipio: consejero.municipio,
          genero: consejero.genero,
          correlativo,
        });

        const updateScope =
          alcance.kind === "MUNICIPAL" ? " AND territorio_id = $4" : "";
        const updateParams =
          alcance.kind === "MUNICIPAL"
            ? [id, codigoUnico, user.sub, alcance.territoryId]
            : [id, codigoUnico, user.sub];
        const { rows } = await client.query(
          `UPDATE consejeros
              SET estado_registro = 'APROBADO',
                  codigo_unico = $2,
                  aprobado_por = $3,
                  fecha_aprobacion = now()
            WHERE id = $1
              AND estado_registro = 'PENDIENTE'
              ${updateScope}
           RETURNING id, estado_registro, codigo_unico, fecha_aprobacion`,
          updateParams
        );
        if (rows.length !== 1) {
          throw new ApprovalConflictError(
            "El registro ya no está pendiente de aprobación"
          );
        }
        return rows[0];
      }
    );

    if (!resultado) return fail("Consejero no encontrado", 404, "NOT_FOUND");
    return ok(resultado);
  } catch (err) {
    if (err instanceof AuthError) {
      return fail(err.message, err.statusCode, "AUTH_ERROR");
    }
    if (err instanceof ApprovalConflictError) {
      return fail(err.message, 409, "CONFLICT");
    }
    console.error("Error interno al procesar aprobación:", err);
    return fail(
      "Error interno al procesar la decisión de aprobación",
      500,
      "INTERNAL_ERROR"
    );
  }
}
