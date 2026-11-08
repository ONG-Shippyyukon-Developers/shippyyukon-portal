# Mapa Backlog → Código

Documento histórico de mapeo. La arquitectura activa y el alcance vigente se rigen por el MVP Final del 4/11/2026: **Vercel + Better Auth/Passkeys + Neon PostgreSQL + RBAC/alcance + RLS**. Las referencias a AWS/Cognito/Aurora describen una propuesta anterior y no autorizan cambios de infraestructura. Épicas B, C y C2 siguen fuera de alcance.

## Épica 0 — Infraestructura y Seguridad Base

| Historia | Estado | Dónde |
|---|---|---|
| HU-00.1 Provisión de cuenta y ambientes AWS | 🟡 Definido en código, no desplegado | `infrastructure/bin/app.ts` (`envName` dev/staging/prod) |
| HU-00.2 Identidad Better Auth/Passkeys | 🟡 JWT Better Auth y resolución Neon conectados en la API local; cliente/passkey del panel y configuración del proveedor pendientes | `services/api/src/middleware/auth.ts`, `apps/web/src/auth/AuthContext.tsx` |
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
| HU-A7 Listado con alcance por rol | 🟡 Filtros por `territorio_id` y contexto RLS conectados; falta validar con rol runtime mínimo en Neon | `services/api/src/handlers/consejeros/list-handler.ts`, `services/api/src/db/client.ts` |

## Épicas B, C, C2 — no construidas

Documentadas en el Backlog; requieren, antes de empezar, la validación de Shippiyyukon sobre el modelo de passkeys para Validadores en Terreno (RawData §12, pregunta 7) y el consentimiento de captura fotográfica de NNA.

## Los tres sitios (confirmado 24/10/2026)

| Sitio | App | Estado |
|---|---|---|
| `shippiyyukon.com` | `apps/landing-shippiyyukon` | ✅ landing estática de una página |
| `red.shippiyyukon.com` | `apps/landing-red` | ✅ landing con CTA al registro |
| `redpanel.shippiyyukon.com` | `apps/web` | ✅ panel con registro gamificado (wizard) + listado |

## Estado y deuda técnica vigente

- **Better Auth/Passkeys:** la API verifica JWT firmado mediante `AUTH_URL` + `AUTH_JWKS_URL` y resuelve solo `sub`; el proveedor debe habilitar su plugin JWT y el panel aún no integra passkeys.
- **Neon:** repositorio de asignaciones y contexto `SET LOCAL` implementados; el cliente API rechaza roles propietarios, administrativos o con `BYPASSRLS`. Falta provisionar y verificar el rol runtime.
- **RLS:** habilitada y forzada en las tablas sensibles; aún no se ha probado con el rol runtime ni con pruebas negativas de acceso cruzado.
- **Territorio:** el catálogo actual es mockup de 5 × 3 y no representa geografía oficial.
- **Vercel:** Preview/Development son los entornos de trabajo; Production no está autorizada por esta fase.
- **AWS:** infraestructura histórica congelada para el MVP. No aprovisionar ni modificar AWS/CDK/KMS/S3 sin autorización expresa.
