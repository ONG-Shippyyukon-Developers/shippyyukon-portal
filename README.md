# Portal Red Nacional "Alianza y Fraternidad" — ONG Los Shippiyyukon

Monorepo del portal de gestión de la Red, construido con TypeScript, React,
Tailwind CSS y Node.js. El MVP vigente utiliza **Vercel + Better Auth/Passkeys +
Neon PostgreSQL + RBAC/alcance + RLS**.

AWS/Cognito/Aurora/KMS/CDK permanece en el repositorio como arquitectura
histórica y está congelada para esta fase. El MVP no procesa datos reales de
niños, niñas ni adolescentes (NNA).

## Estructura

```
apps/
  web/                     Panel protegido
  landing-shippiyyukon/    Landing institucional
  landing-red/             Landing de la Red
services/
  api/                     API Node.js/TypeScript del Módulo A
packages/
  shared/                  Tipos compartidos
infrastructure/            AWS CDK histórico, no activo en el MVP
docs/
  BACKLOG_MAPPING.md        Mapa histórico Backlog → código
```

## Estado técnico

- **Frontend:** TypeScript, React 18, Vite, Tailwind CSS y React Router.
- **Backend/despliegue:** API Node.js en Vercel.
- **Datos:** Neon PostgreSQL con migraciones versionadas y RLS.
- **Identidad API:** verifica JWT Better Auth mediante `AUTH_URL` y
  `AUTH_JWKS_URL` (emisor y audiencia esperados son `AUTH_URL`); solo usa
  `sub` como identidad y no acepta roles del token. El proveedor debe habilitar
  el plugin JWT de Better Auth y exponer claves asimétricas compatibles.
- **Autorización API:** resuelve la asignación vigente en Neon y propaga el
  alcance canónico por `territory_id` al contexto RLS de cada transacción.
- **Passkeys/panel:** el login del panel todavía es un stub; la API requiere
  que el proveedor Better Auth habilite su plugin JWT para emitir tokens
  compatibles con la JWKS configurada.

## Desarrollo local

Requiere Node.js y una conexión **directa** a la base Neon de desarrollo para
migraciones. Configura `DATABASE_URL_UNPOOLED` en `.env.local`; nunca guardes
ni compartas su valor en el repositorio o el chat. La API utiliza
`DATABASE_URL` y rechaza conexiones cuyo rol pueda omitir RLS o administrar la
base. La credencial de migraciones no debe reutilizarse como credencial runtime.

```bash
npm install
npm run db:migrate --workspace=@shippiyyukon/api
npm run test --workspace=@shippiyyukon/api
npm run dev:web
npm run dev:landing-shippiyyukon
npm run dev:landing-red
```

La migración `0001` crea un catálogo territorial **mockup** (5 estados × 3
municipios), asignaciones, delegaciones, consejeros, auditoría y políticas RLS.
No crea usuarios ni asignaciones privilegiadas. La migración `0002` añade un
bootstrap opcional de CTO/DEV principal, limitado al email verificado
`CTO_DEV_BOOTSTRAP_EMAIL`, y funciones de base de datos para asignar/revocar
solo el CTO/DEV secundario. El email se fija una sola vez al ejecutar
migraciones con una conexión administrativa; si no se configura, el bootstrap
permanece deshabilitado. En el primer login autenticado de esa cuenta, una
función transaccional crea la asignación `CTO_DEV / PRIMARY / GLOBAL` y registra
el evento de bootstrap. No se asigna el rol al primer signup arbitrario.

El rol runtime no recibe DML general sobre asignaciones: solo puede ejecutar
esas funciones con la identidad autenticada en el contexto de la transacción.
El modelo permite una posición PRIMARY y una SECONDARY; únicamente PRIMARY
puede asignar o revocar SECONDARY. El CTO secundario no puede revocar al
principal y no existe función para revocar PRIMARY.
`shippiyyukon_runtime` es un rol de grupo sin login ni `BYPASSRLS`; aún falta
crear/configurar el rol login de la aplicación y concederle membresía y
permisos mínimos. Aplicar migraciones no demuestra por sí solo el aislamiento
RLS en ejecución.

Para habilitar el bootstrap en un entorno autorizado, configura
`CTO_DEV_BOOTSTRAP_EMAIL` en el entorno administrativo usado para
`npm run db:migrate --workspace=@shippiyyukon/api`. No compartas ese valor ni
credenciales; el migrador no sobrescribe una allowlist ya configurada.
El flujo requiere una cuenta existente y con email verificado en Neon Auth.
La allowlist fija la identidad elegible, pero no demuestra por sí sola que la
cuenta se haya creado causalmente mediante una invitación.

## Antes de Production

Configurar y verificar el plugin JWT/Passkeys del proveedor Better Auth y su
cliente del panel; configurar el bootstrap solo en el entorno aprobado;
provisionar el rol runtime de mínimo privilegio; probar
asignaciones, aislamiento cruzado y escrituras RLS con datos sintéticos y ese
rol; completar auditoría, CI/CD, Preview y smoke tests. Los tests locales no
sustituyen una prueba de integración contra Neon con el rol runtime. Production
y AWS no están autorizados por el alcance de esta fase.

## Privacidad

La Fase 1A excluye datos reales de NNA. Los módulos que los incorporen
requieren aprobación formal, revisión legal/privacidad, consentimiento,
retención y controles técnicos antes de su implementación.
