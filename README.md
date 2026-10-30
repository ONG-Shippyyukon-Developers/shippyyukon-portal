# Portal Red Nacional "Alianza y Fraternidad" — ONG Los Shippiyyukon

Monorepo del portal de gestión y protección de datos de la Red, construido sobre
AWS, TypeScript, React + Tailwind y Node.js serverless. Este repositorio
implementa **Épica 0 (fundamento) + Épica A (Registro de CPNNA y
Coordinadores)**, que es el alcance definido como "Enfoque Actual" en el
Backlog — ver `docs/BACKLOG_MAPPING.md` para el detalle historia por historia,
incluyendo qué queda pendiente.

Documentos de referencia (fuera de este repo, en Claude): RawData
Técnico-Legal, PRD, DAT y Backlog de Historias de Usuario.

## Estructura

```
apps/
  web/                     redpanel.shippiyyukon.com — panel con RBAC
  landing-shippiyyukon/    shippiyyukon.com — landing institucional
  landing-red/             red.shippiyyukon.com — landing + entrada al registro
services/
  api/                     Lambdas (Node.js/TypeScript) de la Épica A
packages/
  shared/                  Tipos TypeScript compartidos (fuente: RawData §7)
infrastructure/            AWS CDK (TypeScript): Cognito, Aurora, KMS, S3, API Gateway
docs/
  BACKLOG_MAPPING.md        Mapa Backlog → código
```

## Stack

- **Frontend:** TypeScript, React 18, Vite, Tailwind CSS, React Router.
- **Backend:** Node.js 20, TypeScript, AWS Lambda (NodejsFunction), API Gateway (HTTP API).
- **Datos:** PostgreSQL en Amazon Aurora Serverless v2, con Row-Level Security para el aislamiento por municipio.
- **Identidad:** Amazon Cognito con passkeys (WebAuthn/FIDO2) como autenticación para todos los roles internos.
- **Infraestructura como código:** AWS CDK.

## Primeros pasos (desarrollo local)

```bash
npm install                 # instala todo el monorepo (workspaces)
cp .env.example .env         # y completa los valores locales

# Backend: requiere un Postgres local con el esquema aplicado
psql "$DATABASE_URL" -f services/api/src/db/schema.sql
npm run test                 # pruebas unitarias del dominio (sin AWS)

# Frontend
npm run dev:web                      # panel de gestión → localhost:5173
npm run dev:landing-shippiyyukon     # landing institucional
npm run dev:landing-red              # landing de la Red

# Infraestructura (requiere credenciales AWS configuradas)
npm run infra:synth          # genera el CloudFormation sin desplegar
```

## Antes de desplegar a un ambiente real

Lee `docs/BACKLOG_MAPPING.md`, sección "Deuda técnica conocida" — en particular:
completar la integración de passkeys en el frontend, confirmar la lista real
de los 25 municipios piloto, y añadir CloudTrail/GuardDuty/Macie (HU-00.4,
todavía no está en el stack de CDK).

La cuenta AWS se gestiona desde `shippi.dev@gmail.com` como usuario **root**:
actívale MFA desde el primer acceso y no la uses para el día a día — crea
usuarios administrativos vía IAM Identity Center (ver DAT, sección de cuenta AWS).

## Seguridad y datos de NNA

Este repositorio **no** procesa datos de niños, niñas ni adolescentes — el
registro de consejeros (Épica A) solo maneja datos de los funcionarios
públicos que integran la Red. La Épica B (autorizaciones de viaje, que sí
procesa datos y fotografías de NNA) está deliberadamente fuera de este
alcance hasta que Shippiyyukon confirme el modelo de consentimiento y
verificación (RawData §12).
