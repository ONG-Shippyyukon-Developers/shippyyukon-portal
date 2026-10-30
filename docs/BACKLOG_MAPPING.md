# Mapa Backlog → Código

Estado al 24/10/2026. Alcance de este starter: **Épica 0 + Épica A** (ver Backlog, "Enfoque Actual"). Épicas B, C y C2 no están construidas todavía — siguen documentadas en el Backlog para las fases de expansión.

## Épica 0 — Infraestructura y Seguridad Base

| Historia | Estado | Dónde |
|---|---|---|
| HU-00.1 Provisión de cuenta y ambientes AWS | 🟡 Definido en código, no desplegado | `infrastructure/bin/app.ts` (`envName` dev/staging/prod) |
| HU-00.2 Cognito con passkeys | 🟡 User Pool completo; passkey/WebAuthn requiere verificación manual al desplegar (ver TODO en el archivo) | `infrastructure/lib/constructs/auth-construct.ts` |
| HU-00.3 Llaves KMS por municipio | ✅ Una CMK por municipio en `municipiosPiloto` | `infrastructure/lib/constructs/data-construct.ts` |
| HU-00.4 Logging y auditoría | 🔴 No implementado en este starter (CloudTrail/GuardDuty/Macie no están en el stack) | Pendiente — próxima iteración de infra |
| HU-00.5 RBAC por rol | ✅ Matriz de permisos + alcance territorial | `services/api/src/middleware/rbac.ts` |

## Épica A — Registro de CPNNA y Coordinadores

| Historia | Estado | Dónde |
|---|---|---|
| HU-A1 Alta con rol jerárquico | ✅ | `RegistroConsejeroForm.tsx` (paso 2) + `domain/consejero.ts` + `handlers/consejeros/create.ts` |
| HU-A2 Sub-estado de suplencia | ✅ | mismos archivos — validación condicional |
| HU-A3 Datos de nombramiento | ✅ | `RegistroConsejeroForm.tsx` (paso 3) |
| HU-A4 Años de servicio calculados | ✅ función pura, no expuesta aún por un endpoint GET individual | `domain/consejero.ts#calcularAniosServicio` |
| HU-A5 Código único de consejero | ✅ sin dígitos de cédula (Riesgo 5) | `domain/codeGenerator.ts`, con pruebas en `codeGenerator.test.ts` |
| HU-A6 Flujo de aprobación | ✅ | `handlers/consejeros/approve.ts` |
| HU-A7 Listado con alcance por rol | ✅ alcance aplicado vía Row-Level Security | `handlers/consejeros/list.ts`, `ListaConsejeros.tsx`, políticas RLS en `db/schema.sql` |

## Épicas B, C, C2 — no construidas

Documentadas en el Backlog; requieren, antes de empezar, la validación de Shippiyyukon sobre el modelo de passkeys para Validadores en Terreno (RawData §12, pregunta 7) y el consentimiento de captura fotográfica de NNA.

## Los tres sitios (confirmado 24/10/2026)

| Sitio | App | Estado |
|---|---|---|
| `shippiyyukon.com` | `apps/landing-shippiyyukon` | ✅ landing estática de una página |
| `red.shippiyyukon.com` | `apps/landing-red` | ✅ landing con CTA al registro |
| `redpanel.shippiyyukon.com` | `apps/web` | ✅ panel con registro gamificado (wizard) + listado |

## Deuda técnica conocida (léela antes de ir a producción)

- **Aislamiento por municipio:** el starter usa Row-Level Security (lógico) + una CMK por municipio (criptográfico a nivel de infraestructura), pero **no** cifra todavía cada fila con la CMK de su propio municipio a nivel de aplicación — eso es trabajo de la Épica B (fotografías/datos NNA), que aún no se construye.
- **Passkeys:** el User Pool de Cognito está configurado para soportarlos, pero la integración del flujo WebAuthn en el frontend (`apps/web/src/auth/AuthContext.tsx`) es un stub — falta conectar el SDK real.
- **Municipios piloto:** `infrastructure/cdk.json` trae 5 municipios de ejemplo. RawData §12 pregunta 6 (lista real de los 25) sigue abierta.
- **CloudTrail/GuardDuty/Macie (HU-00.4):** no están en el stack de CDK todavía.
