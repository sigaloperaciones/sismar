# Respuesta a la Auditoría de Seguridad y Arquitectura N.º 2 — SISMAR

**De:** AISerNet Company — Equipo ASIA (Arquitectura de Soluciones de Inteligencia Artificial)
**Para:** FOSCAL — Equipo de Ciberseguridad
**Referencia:** Auditoría de caja blanca del 31 de agosto de 2026 (23 hallazgos: 6 altos, 8 medios, 9 bajos)
**Metodología:** STRATA v3 — Flujo `H-003` (`specs/H-003-remediacion-auditoria-2/`: Spec STR-A09, threat model STR-A13, 16 Contratos, 26 Escenarios BDD)
**Fecha de cierre técnico:** 1 de octubre de 2026
**Estado del documento:** CERRADO — 23/23 hallazgos remediados y verificados con evidencia ejecutada, más una **revisión Guardian independiente** posterior (16 hallazgos adicionales R-027…R-042, 13 cerrados). Riesgos residuales para aceptación del cliente: R-020, R-022, R-038; decisión pendiente del cliente: R-029 (purga de historial).

---

## 1. Posición de AISerNet

Agradecemos el informe. Coincidimos con su dictamen central: los controles de la primera
remediación quedaron en la superficie y **la autorización no estaba en el núcleo**. Esta
segunda remediación la lleva al servidor: alcance por agencia (tenencia), pertenencia por
objeto en cada mutación, sesión revocable leída de base de datos en cada petición,
archivos privados con control de acceso por objeto y bitácora de todas las operaciones.

Compromisos cumplidos:
1. Ningún despliegue a pre-producción durante la remediación.
2. Cada remediación tiene código identificable, prueba automatizada y verificación
   ejecutada (209 tests en verde, build de producción, smoke E2E con usuarios de dos
   agencias distintas, mensajero y administrador).
3. Este documento es la respuesta formal punto por punto.

## 2. Plan ejecutado (Pulsos STRATA)

| Pulso | Alcance | Hallazgos | Estado |
|---|---|---|---|
| 1 | Altos: tenencia, IDOR, catálogos, sesión revocable, archivos | A-01 … A-06 | **CERRADO** |
| 2 | Medios: RBAC en páginas, seed, magic bytes, login, Host, CSP, bitácora | M-01 … M-08 | **CERRADO** |
| 3 | Bajos: cookie, enums, transacciones, tests, notificaciones, Zod, docs, saneamiento, usuarios | B-01 … B-09 | **CERRADO** |
| 4 | Verificación integral (tests, build, E2E), documentación, Guardian | re-chequeo 23/23 | **CERRADO** |

## 3. Cambios estructurales (base de todas las remediaciones)

| Pieza | Archivo | Qué resuelve |
|---|---|---|
| Contexto de autenticación fresco | `src/lib/auth-guard.ts`, `src/lib/session-store.ts` | Rol y agencia se leen de BD por petición; sesión en tabla `Sesion` (revocable, expiración absoluta 24 h). |
| Tenencia | `src/lib/tenancy.ts` | Único lugar que decide el alcance (ADMIN/MENSAJERO global; AGENCIA su agencia; AGENCIA sin agencia → nada). Filtros Prisma y verificación de pertenencia. |
| Denegación explícita | `ForbiddenError` + `handleActionError` | Las acciones devuelven `{ error: "... (403)" }`; las páginas renderizan "Acceso denegado"; objetos ajenos → 404; todo queda en bitácora. |
| Bitácora | `src/lib/audit.ts`, modelo `AuditLog` | Quién, qué, cuándo, desde dónde. Append-only. |
| Archivos privados | `src/lib/uploads.ts`, `src/lib/upload-access.ts`, `src/app/api/uploads/route.ts` | Fuera de `public/`, ACL por objeto, magic bytes. |
| Catálogo de permisos | `src/lib/permissions-catalog.ts`, `prisma/sync-permissions.ts` | Nuevos permisos `planillas.gestionar` y `correspondencia.recibir`; sincronización idempotente. |
| Enums e índices | `prisma/schema.prisma`, migración `20261001120000_h003_seguridad_autorizacion` | Integridad en BD conservando datos (`USING`). |

---

## 4. Respuesta punto por punto

> Convención: ✅ RESUELTO (con evidencia) · ⚪ RIESGO RESIDUAL documentado

### Altos

#### A-01 — Sin aislamiento de datos por agencia en lectura — ✅ RESUELTO (C-002, C-007)
- **Remediación:** módulo `src/lib/tenancy.ts` (`correspondenciaWhere`, `planillaWhere`,
  `agenciaWhere`). Aplicado en dashboard, reportes (incluidos contadores y lista de
  agencias del filtro; un `agenciaId` ajeno en la URL se ignora), correspondencia
  entrante/saliente, planillas, detalle de planilla (404 si es ajena; piezas filtradas
  dentro de planillas salientes compartidas), recorridos y "Mis Planillas".
- **Evidencia:** `tests/security/tenancy.test.ts` (alcances y filtros), E2E: usuario
  `gerencia` (agencia 1) ve 3 registros propios en `/reportes` y 0 al forzar
  `?agenciaId=2&search=Talento`; `/planillas/1` (planilla de la agencia 2) → **404**;
  usuario `talento` (agencia 2) ve solo sus 2 registros.

#### A-02 — IDOR: cualquier sesión muta correspondencia ajena — ✅ RESUELTO (C-003)
- **Remediación:** `updateMailAction` carga el registro **antes** de autorizar, exige el
  permiso según el **tipo real** del registro (no el enviado por el cliente), verifica
  pertenencia y prohíbe a una AGENCIA reasignar la pieza a otra agencia.
  `aprobarCorrespondenciaAction`/`devolverCorrespondenciaAction` exigen el permiso
  `correspondencia.recibir` (que MENSAJERO no tiene), pertenencia, estado POR_ENTREGAR y
  planilla CERRADA en recorrido INICIADO. Se registra `recibidoPor`.
- **Evidencia:** `tests/security/authz-actions.test.ts` (S-006, S-007, S-008: AGENCIA
  ajena → 403 sin `update`; tipo manipulado → 403; MENSAJERO → 403; dueña → ENTREGADA).
  E2E: `talento` aprueba su pieza → `ENTREGADA`, `recibidoPor=talento`, fila
  `CORRESPONDENCIA_APROBAR` en bitácora.

#### A-03 — IDOR: ciclo de vida de planillas sin permiso ni dueño — ✅ RESUELTO (C-004)
- **Remediación:** cerrar, reabrir, retirar ítems y subir firma exigen
  `planillas.gestionar` + pertenencia de la planilla (`assertPlanillaAccess`); procesar
  exige `correspondencia.recibir` + pertenencia; generar exige `planillas.crear` +
  pertenencia de la agencia (saliente solo con alcance global).
- **Evidencia:** `authz-actions.test.ts` (S-009, S-010); `actions-guarded.test.ts` exige
  el guard concreto por acción. E2E: usuario AGENCIA no ve botones de gestión y el
  administrador genera planilla saliente #2 (transacción) desde la UI.

#### A-04 — Catálogos mutables por cualquier usuario autenticado — ✅ RESUELTO (C-005)
- **Remediación:** las 15 acciones de `catalogos.ts` (ciudades, empresas de mensajería,
  agencias, centros de costo, sedes) usan `requireAdmin()` de `auth-guard` (rol leído de
  BD). Se eliminó el `requireAdmin` duplicado de `admin.ts`.
- **Evidencia:** S-011 en `authz-actions.test.ts` (AGENCIA con todos los permisos de la
  matriz y MENSAJERO → 403 sin `create`); `actions-guarded.test.ts` falla si vuelve
  `requireSession`.

#### A-05 — JWT no revocable y rol congelado (expiración rolling) — ✅ RESUELTO (C-001)
- **Remediación:** tabla `Sesion` (id aleatorio `sid` en el JWT, `expiresAt`,
  `revokedAt`, `lastSeenAt`, ip, user-agent). `requireSession()` resuelve la sesión y el
  usuario en BD en cada petición: rol/agencia frescos; sesión revocada/expirada o usuario
  borrado → fuera. Logout revoca en servidor; cambiar rol/agencia/contraseña revoca todas
  las sesiones del usuario; borrar usuario las elimina (FK cascade). El middleware **ya no
  re-firma** el token (expiración absoluta 24 h). Nueva ruta `GET /api/auth/expired` borra
  la cookie de una sesión inválida y evita el bucle de redirecciones.
- **Evidencia:** `session-store.test.ts`, `auth-guard.test.ts`, `middleware.test.ts`
  (token antiguo sin `sid` ya no sirve). E2E: sesión de `gerencia` revocada en BD → la
  siguiente petición termina en `/login?expired=1` con aviso; logout de `talento` deja
  `revokedAt` y `/reportes` redirige.

#### A-06 — Imágenes subidas accesibles sin autenticación — ✅ RESUELTO (C-006)
- **Remediación:** directorio privado (`UPLOADS_DIR` o `storage/uploads`; cualquier ruta
  bajo `public/` se rechaza), URL siempre `/api/uploads?filename=…`, nombre generado en
  servidor. `/api/uploads` exige sesión **viva** y **ACL por objeto**: el archivo debe
  estar referenciado por una pieza/planilla/logo que el usuario pueda ver (403 si no; 404
  si nadie lo referencia). El middleware responde 404 a `/uploads/*` y ya no exime
  imágenes fuera de la raíz. Script `prisma/migrate-uploads.ts` traslada los archivos
  legados y reescribe URLs.
- **Evidencia:** `upload-access.test.ts`, `uploads-route.test.ts`, `middleware.test.ts`.
  E2E: `gerencia` lee su guía (200); `talento` → **403** (+ `ARCHIVO_DENEGADO` en
  bitácora); huérfano → 404; traversal → 400; `/uploads/<legado>.pdf` → 404; sin sesión → 401.

### Medios

#### M-01 — RBAC granular existe pero no se aplica en páginas — ✅ RESUELTO (C-007)
- **Remediación:** `requirePagePermission(código)` en planillas, detalle, recorridos,
  reportes, entrante, saliente y "Mis Planillas" (`correspondencia.recibir`); `/admin`
  con `requireAdminPage()`. Sin permiso → componente **Acceso denegado (403)** y fila
  `ACCESO_DENEGADO`, no redirección silenciosa. El menú refleja permisos efectivos.
- **Evidencia:** E2E `/admin/usuarios` como AGENCIA → "ERROR 403 Acceso denegado" y
  bitácora; test estático `page-guards.test.ts` (toda página bajo `(dashboard)` invoca su
  guard propio ANTES de consultar datos; las de `/admin` usan `requireAdminPage`).
  **Nota (revisión Guardian R-028):** en una primera versión las 11 páginas de `/admin`
  confiaban solo en el layout; los layouts de Next pueden omitirse en una petición RSC
  que los declare ya renderizados. Se añadió el guard a cada página y una prueba de
  concepto RSC (ver §6).

#### M-02 — Seed destructivo con contraseña por defecto conocida — ✅ RESUELTO (C-012)
- **Remediación:** `prisma/seed.ts` reescrito: sin `deleteMany`, catálogos y permisos por
  `upsert`, usuarios solo si la tabla está vacía, contraseñas desde `SEED_*_PASSWORD` o
  generadas (16 caracteres) y mostradas una sola vez; aborta con `NODE_ENV=production`
  salvo `SEED_ALLOW_PRODUCTION=1`.
- **Evidencia:** `seed-safety.test.ts`; `no-hardcoded-credentials.test.ts` ahora barre
  también `prisma/`.

#### M-03 — Uploads validan MIME declarado por el cliente — ✅ RESUELTO (C-006)
- **Remediación:** `validateUploadContent` verifica **magic bytes** (`%PDF-`, PNG, JPEG)
  además de MIME, extensión y tamaño; `.gif` retirado de los tipos servidos inline.
- **Evidencia:** `uploads-validation.test.ts` (polyglot `image/jpeg` con HTML rechazado
  también en `saveUploadedFile` sobre disco temporal).

#### M-04 — Rate limit en memoria y por username, no por IP — ✅ RESUELTO / ⚪ R-020 (C-008)
- **Remediación:** límite por usuario (5/min) **y por IP** (20/min) con la IP del último
  salto de `X-Forwarded-For` (el que fija el proxy). Store intercambiable
  (`setRateLimitStore`) para Redis si se escala. **Bloqueo persistente** de cuenta en BD
  (M-08) cubre reinicios y múltiples instancias.
- **Riesgo residual R-020 (AMARILLO):** el contador por ventana sigue en memoria; es
  adecuado para la instancia única actual (PM2, 1 proceso). Migrar a Redis si se escala.
- **Evidencia:** `login-hardening.test.ts`.

#### M-05 — Redirect usa Host y X-Forwarded-Proto sin allowlist — ✅ RESUELTO (C-009)
- **Remediación:** `ALLOWED_HOSTS` (entorno); el `Host` solo se respeta si está en la
  lista; si no, se usa el primer host permitido; proto solo `http|https`; sin lista se
  usa el host resuelto por Next (nunca la cabecera cruda). Aplica al middleware y a
  `/api/auth/expired`. `deploy/setup-sismar.sh` exige `SITE_DOMAIN`.
- **Evidencia:** `request-origin.test.ts`, `middleware.test.ts` (Host `evil.test` →
  redirección al host permitido).

#### M-06 — CSP con unsafe-inline y CSS de marca sin sanitizar — ✅ RESUELTO / ⚪ R-022 (C-010)
- **Remediación:** CSP generada por petición en el middleware con `script-src 'self'
  'nonce-…' 'strict-dynamic'` (sin `unsafe-inline` en scripts); toda la app se renderiza
  dinámicamente para que Next aplique el nonce; `next-themes` recibe el nonce. Colores de
  marca validados con regex HSL en Zod y **re-validados** en `ThemeInjector`; URL de logo
  restringida a ruta relativa o `https:`.
- **Riesgo residual R-022 (AZUL):** `style-src` conserva `'unsafe-inline'` (requisito de
  Next/Radix e impresión). Mitigado: ningún estilo deriva de entrada de usuario sin
  validar.
- **Evidencia:** `csp-branding.test.ts` (incluye `}</style><script>` rechazado y no
  inyectado), `middleware.test.ts`. E2E: 27/27 scripts con nonce, hidratación correcta,
  0 violaciones CSP en consola.

#### M-07 — Sin bitácora ni autoría de operaciones — ✅ RESUELTO (C-011)
- **Remediación:** tabla `AuditLog` (fecha, usuario, acción, entidad, id, detalle JSON,
  IP) escrita por `audit()` en login/logout, accesos denegados, archivos denegados y
  todas las operaciones de negocio y administración; `createdBy/updatedBy` en
  Correspondencia, `createdBy` en Planilla, `recibidoPor` al aprobar. `audit()` nunca
  interrumpe la operación.
- **Evidencia:** `audit.test.ts`; E2E: 8 filas registradas durante la prueba (LOGIN_OK,
  ACCESO_DENEGADO ×3, ARCHIVO_DENEGADO, CORRESPONDENCIA_APROBAR, LOGOUT) con IP.

#### M-08 — Timing oracle en login y sin bloqueo de cuenta — ✅ RESUELTO (C-008)
- **Remediación:** `bcrypt.compare` contra un hash de relleno cuando el usuario no existe
  o está bloqueado; mensaje genérico siempre; `Usuario.failedLoginAttempts/lockedUntil`:
  10 fallos → 15 min, persistente; el éxito reinicia; el administrador desbloquea al
  cambiar la contraseña; auditoría `LOGIN_FALLIDO/LOGIN_BLOQUEADO/LOGIN_LIMITADO`.
- **Evidencia:** `login-hardening.test.ts` (umbral, vencimiento, reinicio, hash válido).

### Bajos

#### B-01 — Cookie de middleware sin path: / — ✅ RESUELTO (C-001)
- Constantes únicas en `src/lib/session-cookie.ts` (sin dependencias, aptas para Edge);
  el middleware ya no emite cookies salvo para limpiar, y lo hace con
  `httpOnly+secure+sameSite+path=/`. Evidencia: `middleware.test.ts`, `cookie-attrs.test.ts`.

#### B-02 — Roles y estados como String — ✅ RESUELTO (C-013)
- Enums `Role, TipoCorrespondencia, Importancia, EstadoCorrespondencia, EstadoPlanilla,
  TipoRecorrido, EstadoRecorrido`. Migración manual con `USING` y pre-chequeo que lista
  valores fuera de dominio. Filtros de reportes validados con `asEnum`. Evidencia:
  migración aplicada sobre una base con datos (roles y asignaciones conservados).

#### B-03 — Sin índices ni transacciones — ✅ RESUELTO (C-013)
- `generatePlanillaAction` en `$transaction` con `updateMany` filtrado por estado (solo
  el primero captura cada pieza). Índices en Correspondencia (estado+tipo+agencia,
  agencia, planilla, createdAt), Planilla (estado+tipo, agencia), Recorrido (estado),
  Sesion, AuditLog. Evidencia: migración; E2E generación de planilla saliente.

#### B-04 — Tests de guards solo comprueban que hay un await — ✅ RESUELTO (C-014)
- `actions-guarded.test.ts` exige el **guard esperado por acción** (y falla ante acciones
  nuevas sin declarar o ante `requireSession` genérico en catálogos). Nuevos tests de
  comportamiento con sesión/Prisma simulados (`authz-actions.test.ts`) reproducen los
  abuse cases AC-002…AC-005. Suite: 26 archivos, 209 tests.

#### B-05 — Notificaciones por consola; usuarios sin email — ✅ RESUELTO / ⚪ R-021 (C-011, C-015)
- Módulo `src/lib/notifications.ts` (proveedor inyectable; en producción no escribe
  datos personales en logs); correo opcional y validado en alta/edición de usuarios
  (campo en el formulario y columna en el listado); avisos de recorrido incluyen el
  correo de la agencia. **R-021 (AMARILLO):** el envío real requiere credenciales SMTP
  del cliente.

#### B-06 — updateMailAction sin esquema Zod — ✅ RESUELTO (C-003)
- `updateMailSchema` (id, textos acotados, importancia enum, agencia numérica);
  identificadores de anexo con tope de 4 000 caracteres de JSON, 50 ítems y 100
  caracteres cada uno. Corrige de paso un error funcional: al editar una saliente el
  formulario envía `destinatarioNombre` y la acción leía `remitenteNombre`, borrando el
  destinatario. Evidencia: `schemas-h003.test.ts`, `authz-actions.test.ts`.

#### B-07 — README de plantilla; ops fuera del repo — ✅ RESUELTO (C-016)
- `README.md` real y `docs/OPERACION.md` (runbook versionado **sin** secretos, IPs ni
  dominios). El runbook interno del VPS incorpora la sección de actualización H-003.

#### B-08 — Dependencia cookie no usada; panillas.ts — ✅ RESUELTO (C-016)
- `cookie` eliminada de `package.json`; `panillas.ts` → `planillas.ts` (imports
  actualizados). Evidencia: `package-deps.test.ts`.

#### B-09 — Rol AGENCIA sin agenciaId — ✅ RESUELTO (C-015)
- `createUserSchema/updateUserSchema` exigen agencia cuando el rol es AGENCIA (también en
  la acción, que además verifica que la agencia exista); AGENCIA sin agencia tiene
  alcance vacío en toda la app. Evidencia: `schemas-h003.test.ts`, `tenancy.test.ts`.

---

## 5. Verificación final (Gate BDD)

| Verificación | Resultado |
|---|---|
| `npm test` | **252 tests en verde** (30 archivos; incluye tests de comportamiento de autorización, tenencia, sesión, archivos, login, CSP, middleware, guards de página, revocación de sesiones y exportación CSV). |
| `tsc --noEmit` | Sin errores. |
| `next build` (producción) | Correcta con **Next.js 16.3.8**; todas las rutas dinámicas (necesario para CSP con nonce). |
| `npm audit --omit=dev` | **0 vulnerabilidades** (antes: 1 crítica y 3 altas en `next` 16.0.8 y transitivas). |
| Migración sobre base con datos | Aplicada; roles, permisos y registros conservados. |
| Smoke E2E (build de producción, PostgreSQL local, 4 usuarios) | AGENCIA 1: tenencia en reportes/planillas, 404 en planilla ajena, 200 en su guía, 403 explícito en administración. AGENCIA 2: 403 al leer la guía de la otra agencia, aprobación de su pieza, logout con revocación. Revocación en BD → `/login?expired=1`. ADMIN: columna correo, matriz con permisos nuevos, planilla saliente generada. 0 violaciones CSP; 27/27 scripts con nonce. |
| Cabeceras (curl) | `/login` 200 con CSP (`nonce-`) y HSTS; `/reportes` sin sesión → 307 `/login` con cookie limpia segura; `/uploads/*` → 404; `/api/uploads` sin sesión → 401; `/loginx` → 307 `/login` (ruta pública exacta). |
| Revisión Guardian independiente | Agente Guardian STRATA sobre el diff completo: 16 hallazgos (1 crítico, 2 altos, 3 medios, 9 bajos, 1 info). Ver §6. |

### Hallazgo propio durante la verificación (resuelto antes de cerrar)
La primera versión de la sesión revocable producía un **bucle de redirecciones**: el
middleware (sin BD) aceptaba un JWT bien firmado y enviaba a `/`, mientras el servidor
detectaba la sesión revocada y enviaba a `/login`. Se añadió `GET /api/auth/expired`
(borra la cookie) y el middleware no rebota desde `/login?expired=1`. Cubierto por tests
y verificado E2E. Es un ejemplo de por qué el Gate exige smoke real y no solo tests.

## 6. Revisión Guardian independiente (tras la remediación) y su cierre

Antes de cerrar el Pulso, una revisión Guardian independiente (capa STRATA con veto) del
cambio completo devolvió 16 hallazgos adicionales. Los tratamos con el mismo rigor que
los del auditor: test rojo → corrección → verificación.

| Código | Sev. | Hallazgo | Resolución |
|---|---|---|---|
| R-027 | Crítico | `next` 16.0.8 con avisos publicados (RCE en Image Optimizer, bypass de middleware, XSS con nonce, CSRF de Server Actions) y transitivas vulnerables. | Actualizado a **16.3.8** + `overrides` de `nanoid`; `npm audit --omit=dev` → 0. Tests, build y E2E repetidos. |
| R-028 | Alto | Las 11 páginas `/admin/*` confiaban solo en el layout (omitible en peticiones RSC). | Guard `requireAdminPage()` en cada página + test estático `page-guards` + PoC RSC. |
| R-029 | Alto | 4 PDFs versionados en `public/uploads` desde el commit inicial (2 facturas personales); credencial por defecto citada en el runbook interno. | Retirados del índice de git; literales saneados; test de credenciales extendido a `docs/` y `deploy/`. **Pendiente de decisión del cliente/AISerNet:** purga del historial en los repositorios (acción coordinada) y evaluación bajo Ley 1581. |
| R-030 | Medio | La firma de una planilla SALIENTE (hoja con TODAS las agencias) era legible por cualquier agencia con una pieza en ella. | ACL solo alcance global; previsualización oculta a AGENCIA; test. |
| R-031 | Medio | Con `planillas.gestionar` delegado, una agencia podía cerrar/reabrir/firmar una saliente compartida. | `assertPlanillaManage` (salientes solo global); test. |
| R-032 | Medio | Hashes heredados de coste 10 invertían el oráculo de tiempo. | Re-hash transparente a coste 12 en el login (solo cubre cuentas que vuelven a entrar); test de comportamiento. **Abierto hasta verificar en el VPS** que no quedan hashes `$2_$10$` (o rotarlos). |
| R-033 | Bajo | `updateMailAction` consultaba la BD antes de autenticar. | `requireSession()` primero; test exige guard antes de Prisma. |
| R-034 | Bajo | Edición en cualquier estado; bitácora sin valores previos. | Solo POR_ENTREGAR sin planilla; `AuditLog.detalle.antes`; tests. |
| R-035 | Bajo | Conteos globales con solo sesión. | Permiso + tenencia. |
| R-036 | Bajo (VIOLETA) | Falsa cobertura en tests estáticos; faltaban tests de páginas, login y revocación. | Comentarios excluidos; `page-guards`, `login-action`, `admin-actions` tests. |
| R-037 | Bajo | Inyección de fórmulas en CSV. | `csvCell`; test. |
| R-038 | Bajo | DoS de login sobre nombres fijos vía bloqueo de cuenta. | Riesgo residual (RADAR): límite por IP, renombrar `admin`, alertar `LOGIN_BLOQUEADO`. |
| R-039 | Bajo | Seed con contraseña de entorno inválida generaba otra sin mostrarla. | Aborta; test. |
| R-040 | Bajo | Alta sin topes de longitud/anexos. | `.max()` y `MAX_ANEXOS=50`; tests. |
| R-041 | Bajo | Carreras verificar-luego-actualizar. | `updateMany` por estado; transacción; índice único parcial de recorrido INICIADO. |
| R-042 | Info | Varios menores (logo `/\host`, `/login` por prefijo, usuario tecleado en bitácora, …). | Corregidos los tres citados; el resto documentado en RADAR. |
| R-043…R-046 | Menores (re-verificación) | Test de credenciales que exigía comillas; anonimización sin sal; `next` sin versión exacta; transiciones de planilla no atómicas. | Los cuatro cerrados (regex estricta; HMAC con secreto; `16.3.8` exacto; `updateMany` condicionado al estado). |
| R-047 | Decisión | El espejo interno (`sigal`) conserva en su historial los PDFs y el runbook con IP. | Incluir en la decisión de purga de R-029 y confirmar si es destinatario autorizado de datos del cliente. |

**Veredicto Guardian tras la re-verificación independiente (dos decisiones separadas):**
1. **Cierre del Pulso: AUTORIZADO** — R-027 y R-028 corregidos con evidencia ejecutada por el propio Guardian.
2. **Despliegue y push al repositorio del cliente: BLOQUEADOS (R-029 en ROJO)** hasta decidir sobre el historial de git (purga o aceptación formal del riesgo, con evaluación bajo Ley 1581), verificar en el VPS que no quedan hashes heredados (R-032) y ejecutar `migrate-uploads` (R-023).

## 7. Riesgos residuales para aceptación del cliente (RADAR)

| Código | Color | Riesgo | Mitigación / plan |
|---|---|---|---|
| R-020 | AMARILLO | Contador de rate limit por ventana en memoria (instancia única). | Bloqueo persistente de cuenta en BD ya cubre reinicios. Redis si se escala horizontalmente. |
| R-021 | AMARILLO | Envío real de correo pendiente de SMTP del cliente. | Módulo listo (`setMailProvider`); sin datos personales en logs. |
| R-022 | AZUL | `style-src 'unsafe-inline'` permanece. | Requisito de Next/Radix; colores validados; sin estilos derivados de entrada de usuario. |
| R-023 | NARANJA → cerrado al desplegar | Archivos legados en `public/uploads` del servidor. | Ejecutar `prisma/migrate-uploads.ts` en el despliegue (paso del runbook); el middleware ya bloquea `/uploads/*`. |
| R-029 | ALTO (decisión pendiente) | Los 4 PDFs permanecen en el HISTORIAL de git de los repositorios (origen, espejo y cliente). | Ya no se versionan. Purgar el historial exige coordinación con el cliente (reescritura de ramas compartidas); evaluar notificación bajo Ley 1581 si las facturas son reales. |
| R-038 | AMARILLO | Bloqueo de cuenta explotable para dejar sin acceso a un usuario conocido (p. ej. `admin`). | Límite por IP (20/min), renombrar la cuenta administrativa en el despliegue, alertar ante `LOGIN_BLOQUEADO`; evaluar bloqueo por (usuario, IP). |

## 8. Pasos operativos de despliegue (resumen)

1. Añadir `ALLOWED_HOSTS` y `UPLOADS_DIR` al `.env` del servidor.
2. `npx prisma migrate deploy && npx prisma generate`.
3. `npx tsx prisma/sync-permissions.ts` y `npx tsx prisma/migrate-uploads.ts`.
4. `npm run build` y reinicio del proceso.
5. Verificar cabeceras y códigos de respuesta (sección 5). Avisar que las sesiones
   anteriores quedan invalidadas.
6. Verificar cuentas con hash heredado: `SELECT username FROM "Usuario" WHERE password LIKE '$2_$10$%'`
   (se re-hashean solas al iniciar sesión; o rotar con `prisma/rotate-passwords.ts`).
7. Ejecutar `npm audit --omit=dev` antes de cada despliegue: debe reportar 0 altas/críticas.

---

*By AISerNet Company — Equipo ASIA · Metodología STRATA v3*
