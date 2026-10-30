-- Migración inicial — Épica 0 (fundamento) + Épica A (Registro de CPNNA y Coordinadores)
-- Fuente: RawData Técnico-Legal §7 (Diccionario de Datos), DAT §5 (Multitenencia)
--
-- NOTA DE ALCANCE (léela antes de desplegar a producción):
-- El DAT (§5/§6) recomienda aislamiento fuerte por municipio vía una AWS KMS
-- Customer Managed Key (CMK) distinta por municipio, además de separación lógica.
-- Esta migración implementa la separación LÓGICA (columna municipio + Row-Level
-- Security de PostgreSQL) como base funcional real y ejecutable hoy. La capa de
-- cifrado por CMK-por-municipio se añade en `infrastructure/` (ver
-- data-construct.ts) y debe aplicarse sobre esta base antes del piloto en
-- producción — no está implementada en este starter repo.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TYPE rol_consejero AS ENUM (
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

-- HU-A5 — correlativo atómico por municipio (nunca se expone la cédula completa, Riesgo 5)
CREATE TABLE municipio_correlativos (
  municipio TEXT PRIMARY KEY,
  siguiente INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE consejeros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  rol rol_consejero NOT NULL,
  sub_estado_suplencia sub_estado_suplencia, -- obligatorio solo si rol = CONSEJERO_SUPLENTE (HU-A2)
  numero_resolucion TEXT NOT NULL,
  fecha_ingreso DATE NOT NULL,
  via_ingreso via_ingreso NOT NULL,
  estado TEXT NOT NULL,
  municipio TEXT NOT NULL, -- límite de tenant (RawData Riesgo 3)
  genero CHAR(1) NOT NULL CHECK (genero IN ('M', 'F')),
  cedula_ultimos_2 CHAR(2) NOT NULL, -- solo uso interno; nunca se expone en el código público (Riesgo 5)
  telefono TEXT,
  correo TEXT,
  codigo_unico TEXT UNIQUE, -- NULL hasta la aprobación (HU-A5 / HU-A6)
  estado_registro estado_registro NOT NULL DEFAULT 'PENDIENTE',
  creado_por UUID NOT NULL, -- id del Coordinador Municipal que cargó el registro
  aprobado_por UUID,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_aprobacion TIMESTAMPTZ,

  CONSTRAINT sub_estado_solo_si_suplente CHECK (
    (rol = 'CONSEJERO_SUPLENTE' AND sub_estado_suplencia IS NOT NULL) OR
    (rol <> 'CONSEJERO_SUPLENTE' AND sub_estado_suplencia IS NULL)
  )
);

CREATE INDEX idx_consejeros_municipio ON consejeros (municipio);
CREATE INDEX idx_consejeros_estado_registro ON consejeros (estado_registro);

-- Row-Level Security — HU-A7 ("un Coordinador Municipal no ve otro municipio") y HU-00.5
ALTER TABLE consejeros ENABLE ROW LEVEL SECURITY;

-- El backend hace SET LOCAL app.current_municipio y app.rol_plataforma al abrir
-- cada transacción (ver db/client.ts), a partir de los claims verificados del JWT.
CREATE POLICY consejeros_select_scope ON consejeros
  FOR SELECT
  USING (
    current_setting('app.rol_plataforma', true) IN ('MASTER', 'COMITE_NACIONAL', 'COORDINADOR_NACIONAL', 'AUDITOR')
    OR municipio = current_setting('app.current_municipio', true)
  );

CREATE POLICY consejeros_insert_scope ON consejeros
  FOR INSERT
  WITH CHECK (
    current_setting('app.rol_plataforma', true) IN ('MASTER', 'COMITE_NACIONAL', 'COORDINADOR_NACIONAL')
    OR municipio = current_setting('app.current_municipio', true)
  );

CREATE POLICY consejeros_update_scope ON consejeros
  FOR UPDATE
  USING (
    current_setting('app.rol_plataforma', true) IN ('MASTER', 'COMITE_NACIONAL', 'COORDINADOR_NACIONAL')
    OR municipio = current_setting('app.current_municipio', true)
  );
