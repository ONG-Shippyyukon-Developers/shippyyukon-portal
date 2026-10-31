# ADR-0002 — MVP con Neon PostgreSQL y Vercel; AWS congelado

- **Estado:** Aceptado para la estrategia de infraestructura del MVP; detalles de identidad y despliegue sujetos a pruebas previas.
- **Fecha:** 2026-10-30
- **Ámbito:** MVP de la Red Alianza y Fraternidad — Épica 0 + Épica A.
- **Decisión rectora:** priorizar la protección de las personas y la salida controlada a producción, no la velocidad a costa de seguridad.

## 1. Decisión

Para el MVP se utilizará:

- **Neon PostgreSQL** como base de datos relacional administrada.
- **Vercel** para frontend y funciones/API de aplicación.
- **Una sola implementación de dominio y persistencia PostgreSQL**, portable entre Neon y Amazon Aurora PostgreSQL.
- **AWS queda congelado como arquitectura futura**: se conservan los archivos CDK, constructos, stacks y decisiones de diseño existentes. No se despliega, destruye, modifica ni elimina infraestructura AWS como parte de esta decisión.

Esta decisión no declara que Neon y Aurora sean operacionalmente idénticos. La compatibilidad deberá demostrarse con pruebas de migración.

## 2. Alcance de datos del MVP

La primera salida a producción se limita al registro y gestión de consejeros/coordinadores (Épica A).

**Fuera de alcance de esta salida:**
- datos de niños, niñas y adolescentes (NNA);
- fotografías, biometría, autorizaciones de viaje y expedientes de NNA;
- carga o consulta de datos externos.

No se habilitará el Módulo B hasta contar con autorización formal de Shippiyyukon, revisión jurídica y de privacidad, EIPD/DPIA, base legal/consentimientos aplicables, política de retención/eliminación, validadores autorizados y pruebas de seguridad específicas.

Los datos de consejeros siguen siendo datos personales y requieren minimización, acceso restringido, retención definida y trazabilidad. No deben usarse datos reales en Preview, desarrollo o pruebas.

## 3. Portabilidad PostgreSQL

Para facilitar Neon → Aurora:

1. Mantener PostgreSQL como motor común y acordar una versión mayor compatible con ambos destinos antes de crear el entorno productivo.
2. Preferir SQL estándar, UUID, constraints, índices y tipos soportados por ambos motores.
3. Evitar dependencias funcionales de extensiones, funciones o APIs exclusivas de Neon.
4. Mantener migraciones SQL incrementales y versionadas en el repositorio. No depender de editar manualmente una base ni de ejecutar el esquema completo en cada despliegue.
5. Separar la identidad de conexión de la lógica de negocio mediante un único módulo de acceso a datos.
6. Usar el endpoint pooled de Neon desde funciones serverless y un pool pequeño por instancia; no abrir una conexión nueva por consulta ni crear pools ilimitados.
7. Ejecutar migraciones con una identidad de despliegue separada de la identidad de runtime. La aplicación no tendrá permisos DDL.
8. No realizar doble escritura Neon/Aurora como mecanismo improvisado de migración.

La migración deberá verificar versión, extensiones, tipos, constraints, índices, secuencias, roles, grants, RLS, conteos, checksums, integridad referencial, rendimiento y restauración.

## 4. Conexión y secretos

- La cadena de conexión completa se almacenará únicamente en variables de entorno protegidas del servidor Vercel, separadas por Development, Preview y Production.
- La variable será server-only (por ejemplo, `DATABASE_URL`); nunca llevará prefijo `VITE_` ni se enviará al navegador.
- No guardar credenciales, tokens, claves, certificados ni cadenas de conexión en Git, issues, logs, documentación pública o tablas de negocio.
- No usar Neon como bóveda de secretos. Neon es la base de datos. Vercel Environment Variables se usarán para los secretos de ejecución del MVP, con acceso administrativo mínimo y rotación documentada.
- Las credenciales de migración y runtime serán diferentes. No utilizar el owner/superuser de PostgreSQL desde la aplicación.
- TLS obligatorio para conexiones. No desactivar validación de certificados en producción.
- No registrar valores de entorno ni cadenas de conexión en logs o mensajes de error.

## 5. Aislamiento por municipio y permisos

La separación de tenants debe estar aplicada en backend y base de datos, no solo en la interfaz.

Antes de producción se requiere:

- Identidad runtime de PostgreSQL distinta de la propietaria de tablas y sin privilegios de superusuario ni `BYPASSRLS`.
- Activar y forzar RLS en las tablas con datos por municipio (`ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`).
- Políticas explícitas por operación y rol, con `USING` y `WITH CHECK` donde aplique.
- Contexto de tenant establecido dentro de la misma transacción y derivado exclusivamente de una sesión autenticada y verificada en servidor.
- Prohibir que el cliente web envíe el rol efectivo o el municipio como autoridad. Los filtros recibidos del cliente nunca amplían el alcance.
- Revisar todas las tablas auxiliares, secuencias, vistas y funciones; no dejar rutas laterales que permitan cruzar municipios.
- Pruebas negativas de lectura, inserción, actualización y enumeración cruzada entre tenants, ejecutadas con el rol real de runtime (no como owner).
- Acceso de auditoría separado y de solo lectura, con alcance aprobado.

RLS con variables de sesión es defensa en profundidad, no sustituye consultas parametrizadas, validación de entradas, privilegios mínimos ni protección contra inyección SQL.

## 6. Identidad y autenticación

La decisión de producto existente exige passkeys/WebAuthn como mecanismo primario para roles internos y no admite SMS ni contraseña como único factor alternativo.

El código actual todavía contiene un stub de autenticación basado en Cognito. Para el MVP con AWS congelado se deberá sustituir ese acoplamiento por una capa de identidad independiente de AWS.

**Candidato técnico para una prueba de concepto:** Better Auth con su plugin Passkey/WebAuthn y almacenamiento PostgreSQL. No se considera aprobado para producción hasta verificar:
- passkey real en los navegadores/dispositivos objetivo;
- verificación de usuario y parámetros WebAuthn requeridos;
- alta de usuarios por invitación/provisión administrativa, sin auto-registro público;
- autenticación sin habilitar password como fallback;
- sesiones mediante cookies Secure, HttpOnly y SameSite apropiado, nunca tokens persistidos en localStorage/sessionStorage;
- revocación de sesión, expiración, rotación y protección CSRF/origin;
- roles y municipio obtenidos del servidor y no modificables por el usuario;
- step-up para operaciones privilegiadas, con verificación resistente a phishing.

Si la prueba no supera los criterios, se evaluará otro proveedor compatible con passkeys antes de publicar. No se rebajará el requisito de autenticación para acelerar la salida.

## 7. Topología Vercel

El panel de gestión debe estar separado del sitio público tanto en autenticación como en política de despliegue.

- El panel `redpanel.shippiyyukon.org` requiere autenticación y autorización en cada endpoint.
- Las landings institucional y de la Red pueden ser públicas; nunca deben compartir rutas que expongan datos administrativos.
- La API debe ejecutarse en runtime Node.js (no Edge por defecto mientras use `pg` y librerías Node), cerca de la región de Neon.
- El frontend no se conecta directamente a Neon. Todas las lecturas y escrituras pasan por API server-side.
- Preferir proyectos Vercel separados por aplicación en el monorepo cuando no esté confirmada la disponibilidad de Vercel Services. La documentación oficial indica que Services es Private Beta y requiere acceso; no se asumirá que está habilitado en la cuenta.
- No cambiar dominios, DNS, SSO o Deployment Protection sin aprobación explícita y pruebas de acceso.

El backend actual usa tipos de eventos AWS Lambda/API Gateway. Debe adaptarse a contratos HTTP estándar de Vercel sin acoplar la lógica de dominio a eventos de un proveedor.

## 8. Auditoría, continuidad y operación

Antes de producción:

- backups automáticos configurados y restauración probada en un ambiente aislado;
- RPO/RTO definidos y aceptados por la organización;
- logs estructurados sin contraseñas, tokens, cadenas de conexión ni datos personales innecesarios;
- eventos de auditoría para accesos y operaciones sensibles, con acceso restringido y protección contra modificación;
- rate limiting, validación de entrada, headers de seguridad y controles de abuso;
- alertas de errores, disponibilidad, saturación y conexiones;
- política de retención y eliminación aprobada; no fijar retenciones arbitrarias en código;
- datos sintéticos en pruebas y ambientes Preview;
- revisión de dependencias y secretos, pruebas automatizadas y pruebas de seguridad antes de cada release.

## 9. Plan de migración a Aurora

1. Congelar y etiquetar el estado de la arquitectura CDK actual; no modificar `infrastructure/` durante el MVP.
2. Mantener las migraciones SQL portables como fuente única de esquema.
3. Ensayar Neon → Aurora en un ambiente no productivo con datos sintéticos.
4. Medir compatibilidad y rendimiento, validar RLS/roles y realizar reconciliación de datos.
5. Definir ventana de mantenimiento, congelación de escrituras y plan de corte.
6. Tomar backup verificable antes del corte.
7. Cambiar la configuración de conexión mediante despliegue controlado; no cambiar lógica de negocio.
8. Validar operaciones críticas y mantener monitorización reforzada.
9. Definir reversión antes del corte: una vez que Aurora acepte escrituras, volver a Neon requiere sincronización inversa o reconciliación controlada. No se debe simplemente cambiar la URL y descartar escrituras posteriores al corte.

## 10. Bloqueos de salida a producción

No se autoriza el paso a producción mientras cualquiera de estos puntos críticos esté pendiente:

- autenticación passkey real y probada;
- autorización server-side y RBAC completo;
- RLS forzada y probada con usuario runtime no propietario;
- API de Vercel operativa y sin dependencia de eventos Lambda;
- Neon con credenciales separadas, TLS, backups y restauración probada;
- aislamiento de ambientes y ausencia de datos reales en Preview;
- auditoría y monitoreo mínimos;
- CI con typecheck, build, pruebas de dominio, integración y seguridad;
- revisión manual de seguridad y aprobación de responsables de Shippiyyukon.

## 11. Hallazgos del código que originan esta ADR

En la revisión de `main` se observó:

- `services/api/src/db/client.ts` ya usa `pg`, pero toma credenciales separadas `DB_HOST/DB_USER/DB_PASSWORD` y documenta Aurora/Lambda.
- `services/api/src/middleware/auth.ts` depende de `aws-jwt-verify` y Cognito.
- `apps/web/src/auth/AuthContext.tsx` tiene `loginConPasskey` como stub.
- Los handlers usan tipos `APIGatewayProxyEventV2`, por lo que requieren una capa HTTP para Vercel.
- `schema.sql` habilita RLS, pero no fuerza RLS; se debe revisar además el rol efectivo de conexión, las políticas por operación y las tablas auxiliares.
- `.env.example` aún refleja la configuración anterior de Aurora/Cognito y debe actualizarse sin incluir valores reales.
- El stack CDK contiene Aurora, KMS y S3. Estos archivos se conservan sin cambios funcionales.

## 12. Referencias técnicas

- Vercel Functions: https://vercel.com/docs/functions
- Vercel monorepos: https://vercel.com/docs/monorepos
- Vercel Services (Private Beta): https://vercel.com/docs/services
- Neon y conexiones serverless: https://neon.com/docs
- Better Auth Passkey: https://better-auth.com/docs/plugins/passkey

---

**Principio no negociable:** la disponibilidad y escalabilidad no justifican exponer datos personales. La primera producción debe procesar únicamente los datos estrictamente necesarios de consejeros; los datos de NNA permanecen fuera de alcance hasta una aprobación específica y una arquitectura de protección validada.
