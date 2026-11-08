# Backend → Frontend Integration Map

Discovery and integration snapshot: 2026-11-06. The API routes and routing configuration exist in the worktree; they have not been deployed or verified against a live runtime.

## Backend → frontend map

| Endpoint | Method | Authentication and authorization | Contract | Frontend status |
|---|---|---|---|---|
| `/api/health` | `GET` | Public health check | `ApiResult` with service status and timestamp | Connected to the existing health handler; no screen consumes it. |
| `/api/auth/context` | `GET` | Better Auth bearer JWT; active assignment required | `ApiResult<ContextoAutorizacion>` with the authenticated subject, assigned role, explicit scope, CTO/DEV position when applicable, and currently implemented capabilities | Endpoint and shared response type implemented. Web auth context does not call it yet. |
| `/api/consejeros` | `GET` | JWT plus active assignment and `consejero:listar`; role and explicit `GLOBAL`/`MUNICIPAL` scope are enforced by the handler | Query: `estado`, `municipio`, `q`; `ApiResult` containing up to 100 database rows | List handler is routed; the existing page uses the same-origin `/api` prefix. Response field casing still needs reconciliation with the frontend `Consejero` type. |
| `/api/consejeros` | `POST` | JWT plus active assignment and `consejero:crear`; territorial scope is checked by the handler | Body: shared `ConsejeroInput`; `ApiResult` containing the inserted row (`201`) | Create handler is routed; the registration form request uses the `/api` prefix. |
| `/api/consejeros/{id}/approve` | `POST` | JWT plus active assignment and `consejero:aprobar`; explicit scope enforced by the handler | UUID path `id`; body `{ "decision": "APROBADO" | "RECHAZADO" }`; `ApiResult` with the updated row | Route is available; no approval screen exists. |
| CTO/DEV secondary assignment/revocation | Not exposed | Internal handlers require CTO/DEV `PRIMARY` and `GLOBAL` | Request fields are defined internally, but method/path contracts are not established | Deliberately not exposed; do not call guessed routes. |
| Users, organizations, invitations, general role/scope administration | No endpoint found | Not applicable | No backend contract found | Not implemented. |

Successful and error responses use the shared `{ ok, data?, error? }` envelope. A Vercel Node.js Web handler at the `api_backend` service entrypoint adapts `Request` objects to the existing framework-neutral API handlers. `vercel.json` routes `/api/*` to the new `api_backend` service before host-based frontend rewrites. The router caps request bodies at 1 MiB, rejects malformed JSON, validates approval IDs, limits methods, and sets `Cache-Control: no-store`.

## Authentication and authorization

- API requests require a Better Auth bearer JWT. The API verifies signature, issuer, audience, and subject using the configured JWKS, then resolves the active assignment in Neon. Client-supplied roles and scopes are never accepted as authority.
- `/api/auth/context` returns only the current authenticated subject's assignment and capabilities. The capability list describes implemented API actions for UI presentation; each operation independently checks authorization server-side.
- The frontend `AuthContext` remains a stub: passkey login throws “pending” and no code obtains or stores the bearer token. `apiClient` still looks for a token in `sessionStorage`.
- Territorial authorization supports `GLOBAL` and `MUNICIPAL`; `ESTADAL` is not represented by the current resolver type.
- CTO/DEV internal handlers are not reachable through the new router because their external method/path contracts were not specified.

## User flow

```text
Visitor
  → Better Auth / passkey browser login (pending provider/client integration)
  → Bearer JWT to API (verification implemented)
  → Active Neon assignment lookup
      → no assignment: 403; no access-request endpoint exists
      → assignment: role + explicit scope checked for every operation
  → GET /api/auth/context (available after login; not consumed by web app)
  → Current dashboard and consejero pages
```

The current web routes are `/`, `/registro`, and `/consejeros`. The shell's navigation is static and is not an authorization control.

## Navigation map

| Server capability | Current UI |
|---|---|
| `consejero:listar` | `/` and `/consejeros` |
| `consejero:crear` | `/registro` |
| `consejero:aprobar` | No screen |
| Manage CTO/DEV secondary | No exposed endpoint or screen |
| Users, organizations, invitations, general roles/scopes | No API or screen |

The web app may use the server-provided context to tailor navigation after authentication is integrated. It must not treat that context as permission to bypass server checks.

## Next dependencies

1. Configure the actual Better Auth/passkey browser client and secure token/session lifecycle. The provider integration and client package/configuration are absent from this repository; do not invent credentials or auth routes.
2. Consume `/api/auth/context` after browser authentication works.
3. Reconcile consejero database response fields with the frontend `Consejero` type and add accessible pending/error/forbidden states.
4. Define explicit public method/path contracts for CTO/DEV assignment and revocation before exposing those internal handlers.
5. Add contracts before implementing account, invitation, user, organization, or general role/scope management.
6. Validate the Vercel Services build and an authorized Preview deployment before considering any Production deployment.

## Vercel project status

The connected Vercel MCP identified the project `shippyyukon-portal`, using the Services framework. Project metadata showed SSO protection enabled for all deployments and a latest deployment marked `READY` with target `production`; the project metadata also reported `live: false`. These details do not verify the new local API service. No Vercel settings, environment variables, domains, deployments, or Production resources were changed.

## Sources

- `vercel.json`
- `apps/web/src/App.tsx`, `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/lib/apiClient.ts`
- `apps/web/src/features/consejeros/ListaConsejeros.tsx`, `apps/web/src/features/consejeros/RegistroConsejeroForm.tsx`
- `services/api/api/index.ts`, `services/api/api/router.ts`
- `services/api/src/handlers/`, `services/api/src/middleware/auth.ts`, `services/api/src/middleware/authorization-resolver.ts`, `services/api/src/middleware/rbac.ts`
- `services/api/src/db/migrations/0001_mvp_core.sql`, `services/api/src/db/migrations/0002_cto_dev_bootstrap_and_authority.sql`
- `packages/shared/src/types.ts`, `services/api/src/utils/response.ts`
- [Vercel Services routing](https://vercel.com/docs/services/routing)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
