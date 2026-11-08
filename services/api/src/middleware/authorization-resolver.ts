import { RolPlataforma } from "@shippiyyukon/shared";
import {
  AuthError,
  type AuthenticatedTerritorialScope,
  type AuthenticatedUser,
} from "./auth-model";
import { withAuthorizationUserContext } from "../db/client";
import type {
  AuthenticatedIdentity,
  AuthorizationResolver,
} from "./auth-boundary";

export interface AuthorizationAssignment {
  identity: AuthenticatedIdentity;
  rolPlataforma: RolPlataforma;
  alcanceTerritorial: AuthenticatedTerritorialScope;
  ctoDevPosition?: "PRIMARY" | "SECONDARY";
}

/**
 * Returns an active authorization assignment for the complete provider identity.
 */
export interface AuthorizationAssignmentRepository {
  findActiveAssignment(
    identity: AuthenticatedIdentity
  ): Promise<AuthorizationAssignment | null>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AssignmentRow {
  user_id: string;
  role: string;
  cto_dev_position: string | null;
  scope_kind: string;
  territory_id: string | null;
  estado: string | null;
  municipio: string | null;
}

export class NeonAuthorizationAssignmentRepository
  implements AuthorizationAssignmentRepository
{
  async findActiveAssignment(
    identity: AuthenticatedIdentity
  ): Promise<AuthorizationAssignment | null> {
    if (!UUID_PATTERN.test(identity.subject)) {
      throw new AuthError("La identidad autenticada no es válida", 401);
    }

    return withAuthorizationUserContext(identity.subject, async (client) => {
      const assignmentQuery = `
        SELECT assignment.user_id::text AS user_id,
               assignment.role::text AS role,
               assignment.cto_dev_position::text AS cto_dev_position,
               assignment.scope_kind::text AS scope_kind,
               assignment.territory_id::text AS territory_id,
               territory.estado,
               territory.municipio
          FROM authorization_assignments AS assignment
          LEFT JOIN territories AS territory
            ON territory.id = assignment.territory_id
           AND territory.activo = TRUE
         WHERE assignment.user_id = $1::uuid
           AND assignment.is_active = TRUE
           AND assignment.revoked_at IS NULL
           AND assignment.valid_from <= now()
           AND (
             assignment.valid_until IS NULL
             OR assignment.valid_until > now()
           )
           AND (
             assignment.scope_kind = 'GLOBAL'
             OR territory.id IS NOT NULL
           )
         LIMIT 2`;
      let { rows } = await client.query<AssignmentRow>(
        assignmentQuery,
        [identity.subject]
      );

      if (rows.length === 0) {
        const { rows: bootstrapRows } = await client.query<{
          bootstrapped: boolean;
        }>("SELECT public.bootstrap_initial_cto_dev() AS bootstrapped");
        if (bootstrapRows[0]?.bootstrapped) {
          ({ rows } = await client.query<AssignmentRow>(assignmentQuery, [
            identity.subject,
          ]));
        }
      }

      if (rows.length === 0) return null;
      if (rows.length !== 1) {
        throw new Error(
          "Multiple active authorization assignments exist for one user"
        );
      }

      const row = rows[0];
      if (!Object.values(RolPlataforma).includes(row.role as RolPlataforma)) {
        throw new Error("Database returned an unsupported platform role");
      }

      let alcanceTerritorial: AuthenticatedTerritorialScope;
      if (row.scope_kind === "GLOBAL" && row.territory_id === null) {
        alcanceTerritorial = { kind: "GLOBAL" };
      } else if (
        row.scope_kind === "MUNICIPAL" &&
        row.territory_id &&
        row.estado &&
        row.municipio
      ) {
        alcanceTerritorial = {
          kind: "MUNICIPAL",
          territoryId: row.territory_id,
          estado: row.estado,
          municipio: row.municipio,
        };
      } else {
        throw new Error("Database returned an inconsistent territorial scope");
      }

      let ctoDevPosition: "PRIMARY" | "SECONDARY" | undefined;
      if (row.role === RolPlataforma.CTO_DEV) {
        if (
          row.cto_dev_position !== "PRIMARY" &&
          row.cto_dev_position !== "SECONDARY"
        ) {
          throw new Error(
            "Database returned a CTO/DEV assignment without a position"
          );
        }
        if (alcanceTerritorial.kind !== "GLOBAL") {
          throw new Error("CTO/DEV assignments require explicit GLOBAL scope");
        }
        ctoDevPosition = row.cto_dev_position;
      } else if (row.cto_dev_position !== null) {
        throw new Error("Database returned a CTO/DEV position for another role");
      }

      return {
        identity,
        rolPlataforma: row.role as RolPlataforma,
        alcanceTerritorial,
        ...(ctoDevPosition ? { ctoDevPosition } : {}),
      };
    });
  }
}

export class RepositoryAuthorizationResolver implements AuthorizationResolver {
  constructor(private readonly repository: AuthorizationAssignmentRepository) {}

  async resolve(identity: AuthenticatedIdentity): Promise<AuthenticatedUser> {
    const assignment = await this.repository.findActiveAssignment(identity);
    if (!assignment) {
      throw new AuthError(
        "La identidad autenticada no tiene una asignación de acceso activa",
        403
      );
    }
    if (
      assignment.identity.provider !== identity.provider ||
      assignment.identity.subject !== identity.subject
    ) {
      throw new AuthError(
        "La asignación de acceso no corresponde a la identidad autenticada",
        403
      );
    }
    if (
      assignment.rolPlataforma === RolPlataforma.CTO_DEV &&
      (assignment.alcanceTerritorial.kind !== "GLOBAL" ||
        (assignment.ctoDevPosition !== "PRIMARY" &&
          assignment.ctoDevPosition !== "SECONDARY"))
    ) {
      throw new AuthError(
        "La asignación CTO/DEV requiere posición y alcance GLOBAL explícitos",
        403
      );
    }

    return {
      sub: identity.subject,
      rolPlataforma: assignment.rolPlataforma,
      alcanceTerritorial: assignment.alcanceTerritorial,
      ...(assignment.ctoDevPosition
        ? { ctoDevPosition: assignment.ctoDevPosition }
        : {}),
    };
  }
}
