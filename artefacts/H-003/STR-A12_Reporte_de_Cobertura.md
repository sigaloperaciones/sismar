# STR-A12 · Reporte de Cobertura — Flujo H-003 (01/10/2026, tras revisión Guardian)

Comando: `npx vitest run --coverage --coverage.include='src/lib/**'` (proveedor v8). Suite: **30 archivos, 252 tests**.

| Archivo | % Sentencias | % Ramas | % Funciones | % Líneas |
|---|---|---|---|---|
| **Total `src/lib`** | **81,39** | **81,44** | **86,31** | **82,67** |
| audit.ts | 100 | 84,21 | 100 | 100 |
| auth-guard.ts | 77,35 | 82,85 | 84,61 | 76,08 |
| auth.ts | 87,5 | 75 | 75 | 92,85 |
| branding.ts | 84,61 | 85,71 | 100 | 100 |
| permissions.ts | 87,5 | 75 | 100 | 92,3 |
| rate-limit.ts | 83,87 | 85 | 85,71 | 88,88 |
| request-meta.ts | 89,47 | 83,33 | 100 | 87,5 |
| session-store.ts | 58,62 | 59,25 | 50 | 56,52 |
| upload-access.ts | 92,85 | 91,66 | 100 | 100 |
| uploads.ts | 86,48 | 86,15 | 100 | 88,23 |
| csv.ts, login-policy.ts, tenancy.ts, request-origin.ts, csp.ts, session-cookie.ts | 100 | — | — | 100 |
| enums.ts, notifications.ts, permissions-sync.ts, prisma.ts, utils.ts | 0 | — | — | 0 |

Notas:
- Umbral STRATA (> 80 %) cumplido en el agregado de la capa Lógica/Guardian.
- `permissions-sync.ts` se ejecuta en el seed y en `sync-permissions.ts` (verificado contra la BD local). `notifications.ts` sin proveedor real (R-021). `session-store.ts`: `createSession`/`purgeSessions` cubiertos por E2E (login real creó filas `Sesion`), no por unit test.
- Páginas y componentes: validados por `tsc`, `next build`, smoke E2E y el test estático `page-guards` (R-024).
