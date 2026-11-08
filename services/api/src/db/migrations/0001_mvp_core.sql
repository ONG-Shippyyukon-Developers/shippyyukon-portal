CREATE TYPE platform_role AS ENUM (
  'CTO_DEV',
  'MASTER',
  'COMITE_NACIONAL',
  'COORDINADOR_NACIONAL',
  'COORDINADOR_ESTADAL',
  'COORDINADOR_MUNICIPAL',
  'CONSEJERO',
  'VALIDADOR_TERRENO',
  'AUDITOR'
);

CREATE TYPE territorial_scope_kind AS ENUM ('GLOBAL', 'MUNICIPAL');

CREATE TYPE consejero_role AS ENUM (
  'COORDINADOR_NACIONAL',
  'COORDINADOR_ESTADAL',
  'COORDINADOR_MUNICIPAL',
  'CONSEJERO_PRINCIPAL',
  'CONSEJERO_SUPLENTE'
);

CREATE TYPE sub_estado_suplencia AS ENUM (
  'PERMANENTE_FIJO',
  'SUPLENCIA_TEMPORAL',
  'LISTADO_SUPLENTE'
);

CREATE TYPE via_ingreso AS ENUM (
  'CONCURSO_OPOSICION',
  'DESIGNACION_DIRECTA'
);

CREATE TYPE estado_registro AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO'
);

CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estado TEXT NOT NULL,
  municipio TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT territories_estado_municipio_unique UNIQUE (estado, municipio),
  CONSTRAINT territories_identity_unique UNIQUE (id, estado, municipio)
);

INSERT INTO territories (estado, municipio) VALUES
  ('Estado 1', 'Municipio A'),
  ('Estado 1', 'Municipio B'),
  ('Estado 1', 'Municipio C'),
  ('Estado 2', 'Municipio A'),
  ('Estado 2', 'Municipio B'),
  ('Estado 2', 'Municipio C'),
  ('Estado 3', 'Municipio A'),
  ('Estado 3', 'Municipio B'),
  ('Estado 3', 'Municipio C'),
  ('Estado 4', 'Municipio A'),
  ('Estado 4', 'Municipio B'),
  ('Estado 4', 'Municipio C'),
  ('Estado 5', 'Municipio A'),
  ('Estado 5', 'Municipio B'),
  ('Estado 5', 'Municipio C');

CREATE TABLE authorization_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  role platform_role NOT NULL,
  scope_kind territorial_scope_kind NOT NULL,
  territory_id UUID REFERENCES territories(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  granted_by_user_id UUID REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grant_reason TEXT NOT NULL,
  revoked_by_user_id UUID REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  CONSTRAINT authorization_assignments_scope_consistent CHECK (
    (scope_kind = 'GLOBAL' AND territory_id IS NULL) OR
    (scope_kind = 'MUNICIPAL' AND territory_id IS NOT NULL)
  ),
  CONSTRAINT authorization_assignments_validity CHECK (
    valid_until IS NULL OR valid_until > valid_from
  ),
  CONSTRAINT authorization_assignments_revocation_consistent CHECK (
    (revoked_at IS NULL AND revoked_by_user_id IS NULL AND revoke_reason IS NULL) OR
    (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND revoke_reason IS NOT NULL)
  ),
  CONSTRAINT authorization_assignments_grant_reason_nonempty CHECK (
    length(trim(grant_reason)) > 0
  )
);

CREATE UNIQUE INDEX authorization_assignments_one_active_per_user
  ON authorization_assignments (user_id)
  WHERE is_active AND revoked_at IS NULL;

CREATE INDEX authorization_assignments_user_validity
  ON authorization_assignments (user_id, valid_from, valid_until)
  WHERE is_active AND revoked_at IS NULL;

CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  delegate_user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  permission TEXT NOT NULL,
  scope_kind territorial_scope_kind NOT NULL,
  territory_id UUID REFERENCES territories(id) ON DELETE RESTRICT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  granted_by_user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grant_reason TEXT NOT NULL,
  revoked_by_user_id UUID REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  CONSTRAINT delegations_distinct_users CHECK (delegator_user_id <> delegate_user_id),
  CONSTRAINT delegations_permission_nonempty CHECK (length(trim(permission)) > 0),
  CONSTRAINT delegations_validity CHECK (valid_until > valid_from),
  CONSTRAINT delegations_scope_consistent CHECK (
    (scope_kind = 'GLOBAL' AND territory_id IS NULL) OR
    (scope_kind = 'MUNICIPAL' AND territory_id IS NOT NULL)
  ),
  CONSTRAINT delegations_revocation_consistent CHECK (
    (revoked_at IS NULL AND revoked_by_user_id IS NULL AND revoke_reason IS NULL) OR
    (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND revoke_reason IS NOT NULL)
  ),
  CONSTRAINT delegations_grant_reason_nonempty CHECK (
    length(trim(grant_reason)) > 0
  )
);

CREATE INDEX delegations_delegate_validity
  ON delegations (delegate_user_id, permission, valid_from, valid_until)
  WHERE revoked_at IS NULL;

CREATE TABLE territory_counters (
  territory_id UUID PRIMARY KEY REFERENCES territories(id) ON DELETE RESTRICT,
  siguiente INTEGER NOT NULL DEFAULT 1 CHECK (siguiente > 0)
);

CREATE TABLE consejeros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  rol consejero_role NOT NULL,
  sub_estado_suplencia sub_estado_suplencia,
  numero_resolucion TEXT NOT NULL,
  fecha_ingreso DATE NOT NULL,
  via_ingreso via_ingreso NOT NULL,
  estado TEXT NOT NULL,
  municipio TEXT NOT NULL,
  territorio_id UUID NOT NULL,
  genero CHAR(1) NOT NULL CHECK (genero IN ('M', 'F')),
  cedula_ultimos_2 CHAR(2) NOT NULL CHECK (cedula_ultimos_2 ~ '^[0-9]{2}$'),
  telefono TEXT,
  correo TEXT,
  codigo_unico TEXT UNIQUE,
  estado_registro estado_registro NOT NULL DEFAULT 'PENDIENTE',
  creado_por UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  aprobado_por UUID REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_aprobacion TIMESTAMPTZ,
  CONSTRAINT consejeros_territory_identity_fk
    FOREIGN KEY (territorio_id, estado, municipio)
    REFERENCES territories (id, estado, municipio)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT consejeros_sub_estado_solo_suplente CHECK (
    (rol = 'CONSEJERO_SUPLENTE' AND sub_estado_suplencia IS NOT NULL) OR
    (rol <> 'CONSEJERO_SUPLENTE' AND sub_estado_suplencia IS NULL)
  ),
  CONSTRAINT consejeros_approval_consistent CHECK (
    (estado_registro = 'APROBADO' AND aprobado_por IS NOT NULL AND fecha_aprobacion IS NOT NULL) OR
    (estado_registro <> 'APROBADO' AND fecha_aprobacion IS NULL)
  )
);

CREATE INDEX consejeros_territorio_idx ON consejeros (territorio_id);
CREATE INDEX consejeros_estado_registro_idx ON consejeros (estado_registro);

CREATE TABLE authorization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  assignment_id UUID REFERENCES authorization_assignments(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  scope_kind territorial_scope_kind,
  territory_id UUID REFERENCES territories(id) ON DELETE RESTRICT,
  request_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authorization_audit_action_nonempty CHECK (length(trim(action)) > 0),
  CONSTRAINT authorization_audit_entity_nonempty CHECK (length(trim(entity_type)) > 0),
  CONSTRAINT authorization_audit_scope_consistent CHECK (
    scope_kind IS NULL OR
    (scope_kind = 'GLOBAL' AND territory_id IS NULL) OR
    (scope_kind = 'MUNICIPAL' AND territory_id IS NOT NULL)
  )
);

CREATE INDEX authorization_audit_actor_time_idx
  ON authorization_audit_log (actor_user_id, created_at DESC);

CREATE INDEX authorization_audit_entity_idx
  ON authorization_audit_log (entity_type, entity_id, created_at DESC);

ALTER TABLE authorization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY authorization_assignments_read_self
  ON authorization_assignments FOR SELECT
  USING (
    user_id = NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid
  );

ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations FORCE ROW LEVEL SECURITY;
CREATE POLICY delegations_read_participant
  ON delegations FOR SELECT
  USING (
    delegator_user_id = NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid
    OR delegate_user_id = NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid
  );

ALTER TABLE territory_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY territory_counters_scope
  ON territory_counters FOR ALL
  USING (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territory_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territory_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  );

ALTER TABLE consejeros ENABLE ROW LEVEL SECURITY;
ALTER TABLE consejeros FORCE ROW LEVEL SECURITY;
CREATE POLICY consejeros_scope_select
  ON consejeros FOR SELECT
  USING (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territorio_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  );
CREATE POLICY consejeros_scope_insert
  ON consejeros FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territorio_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  );
CREATE POLICY consejeros_scope_update
  ON consejeros FOR UPDATE
  USING (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territorio_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.scope_kind', TRUE), '') = 'GLOBAL'
    OR (
      NULLIF(current_setting('app.scope_kind', TRUE), '') = 'MUNICIPAL'
      AND territorio_id = NULLIF(current_setting('app.territory_id', TRUE), '')::uuid
    )
  );

ALTER TABLE authorization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY authorization_audit_insert_actor
  ON authorization_audit_log FOR INSERT
  WITH CHECK (
    actor_user_id = NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid
  );
CREATE POLICY authorization_audit_read_actor
  ON authorization_audit_log FOR SELECT
  USING (
    actor_user_id = NULLIF(current_setting('app.authenticated_user_id', TRUE), '')::uuid
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shippiyyukon_runtime') THEN
    EXECUTE 'CREATE ROLE shippiyyukon_runtime
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
  END IF;
END
$$;

GRANT shippiyyukon_runtime TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO shippiyyukon_runtime;
GRANT USAGE ON TYPE
  platform_role,
  territorial_scope_kind,
  consejero_role,
  sub_estado_suplencia,
  via_ingreso,
  estado_registro
TO shippiyyukon_runtime;

GRANT SELECT ON territories TO shippiyyukon_runtime;
GRANT SELECT ON authorization_assignments, delegations TO shippiyyukon_runtime;
GRANT SELECT, INSERT, UPDATE ON territory_counters TO shippiyyukon_runtime;
GRANT SELECT, INSERT, UPDATE ON consejeros TO shippiyyukon_runtime;
GRANT SELECT, INSERT ON authorization_audit_log TO shippiyyukon_runtime;
