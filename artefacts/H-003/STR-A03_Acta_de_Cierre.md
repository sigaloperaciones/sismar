# STR-A03 · Acta de Cierre de Pulso — Flujo H-003 (A4-P1…P4)

**Fecha:** 01/10/2026 · **Facilitador:** Claude (Fable 5.1) · **Guardian:** revisión técnica independiente (agente Guardian STRATA) + re-verificación; **firma humana pendiente: Mauricio Tarazona**.

## 1. Entregable y verificación con evidencia real

| Verificación | Evidencia |
|---|---|
| Gate TDD — tests | `npm test`: **30 archivos, 252 tests en verde** (vitest 4.1.10). Nuevos en H-003: tenancy, session-store, auth-guard, authz-actions (comportamiento por rol), upload-access, uploads-route, uploads-validation (magic bytes + disco), login-hardening, login-action (comportamiento con Prisma/bcrypt), admin-actions (revocación), page-guards (guard propio en toda página), request-origin, csp-branding, middleware, seed-safety, schemas-h003, audit, csv-export. Actualizados: actions-guarded (mapa acción→guard, sin comentarios), cookie-attrs, headers, package-deps, permission-enforcement, zod-integration, no-hardcoded-credentials (barre también docs/ y deploy/), password-policy. |
| Gate TDD — cobertura | `src/lib/**`: **81,39 % sentencias · 81,44 % ramas · 86,31 % funciones · 82,67 % líneas** (umbral > 80 %; medido tras la revisión Guardian). Sin medir: componentes React y páginas (validados por build + E2E + test estático de guards). |
| Tipos | `tsc --noEmit` sin errores. |
| Dependencias | `next` **16.3.8** (desde 16.0.8 con aviso crítico); `overrides.nanoid ^3.3.18`; `npm audit --omit=dev`: **0 vulnerabilidades**. |
| Build | `next build` producción correcta; 23 rutas, todas dinámicas (CSP con nonce). |
| Migraciones | `20261001120000_h003_seguridad_autorizacion` (enums con USING, Sesion, AuditLog, bloqueo, autoría, índices) y `20261001133000_h003_recorrido_unico_activo` (índice único parcial) aplicadas sobre BD local con datos; sin pérdida. |
| Gate BDD — smoke E2E (navegador, build de producción, PostgreSQL 16 en Docker) | S-001/S-002/S-003 revocación (BD y logout) → `/login?expired=1`; S-004 tenencia en reportes; S-006…S-010 vía tests + aprobación real de pieza propia; S-012/S-013 archivos (200 propio, 403 ajeno con bitácora, 404 huérfano, 400 traversal, 404 `/uploads` legado, 401 sin sesión); S-015 "Acceso denegado 403" en `/admin` como AGENCIA; S-019 CSP: 0 scripts sin nonce, 0 violaciones, hidratación correcta (también con Next 16.3.8); S-021 bitácora con IP; generación transaccional de planilla saliente. PoC RSC (R-028) con cookies de AGENCIA, revocada y ADMIN: sin fuga de datos de administración. |
| Escenarios BDD | 26/26 cubiertos por test y/o E2E; abuse cases AC-001…AC-022 cubiertos (AC-016…AC-022 añadidos por la revisión Guardian). |

## 2. Hallazgos durante el Pulso (resueltos antes del cierre)
1. **Bucle de redirecciones** al revocar sesión → `GET /api/auth/expired` + `?expired=1`. Detectado SOLO por smoke E2E.
2. **Nonce de CSP** no aplicado en páginas prerenderizadas y en `next-themes` → `force-dynamic` + `nonce` al ThemeProvider.
3. **Bug funcional colateral**: editar una saliente borraba el destinatario → `updateMailSchema`.
4. **Revisión Guardian independiente** (16 hallazgos R-027…R-042; ver `RADAR.md`): 13 cerrados con test rojo→verde (dependencias vulnerables, guard propio en páginas admin, firma de salientes, gestión de salientes compartidas, re-hash de contraseñas heredadas, orden guard→BD, cadena de custodia, conteos con tenencia, falsa cobertura, CSV, seed, topes, carreras). R-038 queda como riesgo residual documentado; R-029 (purga de historial) requiere decisión humana; R-042 parcialmente aceptado y documentado.

## 3. Validación Guardian
- Secretos: ninguno en código ni docs (`.env` ignorado; `.env.example` con placeholders; literales de contraseña por defecto retirados de `docs/`).
- Autorización a nivel de registro: tenencia + pertenencia en todas las mutaciones por id; guard propio en TODAS las páginas (no se confía en layouts).
- Datos personales: `public/uploads` ya no se versiona (quedan en el historial: R-029, decisión humana); el usuario tecleado en logins fallidos se guarda anonimizado.
- **Veredicto Guardian (re-verificación independiente, 01/10/2026) — dos decisiones separadas:**
  1. **Cierre del Pulso: AUTORIZADO.** R-027 (crítico) y R-028 (alto) corregidos con evidencia ejecutada por el Guardian (`npm test` 252/252, `tsc`, `npm audit` 0, guards en las 19 páginas). Menores R-043…R-046 cerrados tras la re-verificación.
  2. **Despliegue y push al remoto del cliente: BLOQUEADOS (R-029 en ROJO)** hasta que: (a) Mauricio registre su decisión sobre el historial de git (purga con `git filter-repo` en origin, sigal y foscal, o aceptación formal del riesgo) y la evaluación bajo Ley 1581, incluida la confirmación de si `sigal` es destinatario autorizado (R-047); (b) en el VPS la consulta de hashes heredados devuelva 0 filas o se ejecute `rotate-passwords` (R-032); (c) se ejecute `migrate-uploads` (R-023).
- El PoC RSC (`tests/e2e/rsc-admin-bypass.poc.ts`) lo ejecutó el Facilitador contra el servidor local; el Guardian no lo repitió (requiere app levantada) y pide que una persona lo confirme en el Momento 2.
- **Firma humana del Guardian: pendiente (Mauricio Tarazona).**

## 4. Deuda técnica y RADAR
Ver `RADAR.md`: abiertos R-020, R-021, R-023, R-024, R-025, R-026, R-029 (decisión), R-038; aceptados R-022 y parte de R-042.

## 5. Documentación actualizada
`README.md`, `docs/OPERACION.md`, `docs/DEPLOY_VPS_HOSTINGER_SISMAR.md` (sección H-003), `docs/auditoria/RESPUESTA_AUDITORIA_2_SISMAR.md` (incluye §6 revisión Guardian), `.env.example`, `deploy/setup-sismar.sh`, memoria Guardian y skill `gate-guardian` (puntos 11–16). Manuales (Usuario, Técnico, Implementación) por `strata-documentador` en `docs/manuales/`.
