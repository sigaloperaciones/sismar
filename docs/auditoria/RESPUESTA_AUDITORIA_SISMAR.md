# Respuesta a la Auditoría de Seguridad Estática (SAST) — SISMAR

**De:** AISerNet Company — Equipo ASIA (Arquitectura de Soluciones de Inteligencia Artificial)
**Para:** FOSCAL — Equipo de Ciberseguridad
**Referencia:** Auditoría SAST SISMAR del 14 de julio de 2026 (20 hallazgos: 4 críticos, 6 altos, 8 medios, 2 bajos)
**Estado del documento:** CERRADO — 19/20 hallazgos remediados y verificados; SEC-016 se responde como excepción justificada (aceptación de riesgo), sujeta a confirmación del cliente.

---

## 1. Posición de AISerNet

Agradecemos el informe. El equipo ASIA verificó **cada hallazgo contra el código fuente**
y confirma la validez de 19 de los 20 puntos (el restante, SEC-001, ya había sido
remediado el 15/07/2026, commit `b55b4f8`, previo a la recepción del informe).

Compromisos:
1. **Ningún despliegue a pre-producción** hasta cerrar el 100% de los hallazgos
   críticos y altos, y tener plan aceptado para medios y bajos.
2. Cada remediación se entrega con **commit identificable, prueba automatizada y evidencia
   de verificación** (metodología STRATA v3 de AISerNet: Gate SDD/TDD/BDD).
3. Este documento constituye la respuesta formal punto por punto.

## 2. Plan de remediación (4 Pulsos STRATA)

| Pulso | Alcance | Hallazgos | Estado |
|-------|---------|-----------|--------|
| 1 | Críticos | SEC-001 ✅, SEC-002 ✅, SEC-003 ✅, SEC-004 ✅ | **CERRADO** (15/07/2026) |
| 2 | Altos | SEC-005 … SEC-010 | **CERRADO** (15/07/2026) |
| 3 | Medios | SEC-011 … SEC-018 (SEC-016 = excepción justificada) | **CERRADO** (15/07/2026) |
| 4 | Bajos + verificación integral | SEC-019, SEC-020 + re-chequeo 20/20 | **CERRADO** (15/07/2026) |

---

## 3. Respuesta punto por punto

> Convención de estados: ✅ RESUELTO (con evidencia) · 🔧 EN CURSO · ⏳ PLANIFICADO · 💬 EN DISCUSIÓN

### SEC-001 — Archivo `.env` con credenciales no excluido de Git — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado en revisión propia previa al informe.
- **Remediación:** `.env` retirado del control de versiones (`git rm --cached`) y añadido a
  `.gitignore` junto con `.env.docker`. En despliegue, los secretos se generan en el
  servidor y nunca se versionan.
- **Sobre rotación de credenciales:** el `.env` versionado contenía únicamente el
  placeholder de desarrollo `postgres:postgres@127.0.0.1` — nunca una credencial de un
  entorno real. No obstante, las credenciales de los entornos desplegados se generan
  aleatoriamente (`openssl rand`) por servidor y no coinciden con dicho placeholder.
- **Evidencia:** commit `b55b4f8` (15/07/2026); `git ls-files | grep .env` → solo `.env.example`.

### SEC-002 — Credenciales de prueba expuestas en página de login — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado en `src/app/(auth)/login/page.tsx:149-152`.
- **Remediación:** el bloque de credenciales se **eliminó por completo** del componente
  (más estricto que la recomendación de gate por `NODE_ENV`: el dato no existe en ningún
  bundle). Test de regresión (`tests/security/no-hardcoded-credentials.test.ts`) que
  escanea todo `src/` y falla si la contraseña semilla reaparece como literal.
  La rotación de contraseñas de los usuarios semilla queda como paso obligatorio del
  runbook antes de exponer cualquier entorno (RADAR).
- **Evidencia:** test en verde; smoke E2E sobre build de producción: `GET /login` sin
  ninguna ocurrencia de credenciales (verificado con curl y navegador). Commit del Pulso 1.

### SEC-003 — Server actions sin autenticación ni autorización — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado: `correspondencia.ts`, `catalogos.ts`, `panillas.ts`
  sin verificación de sesión; `recorridos.ts` parcial; solo `admin.ts` protegido.
- **Remediación:** nuevo guard central `src/lib/auth-guard.ts` con `requireSession()` y
  `requirePermission(código)` (usa el sistema `Permiso/RolPermiso` existente). Se
  protegieron las **25 server actions** de negocio:
  - Con permiso granular: `registerIncomingMail` → `correspondencia.entrante.crear`;
    `registerOutgoingMail` → `correspondencia.saliente.crear`; `generatePlanillaAction` →
    `planillas.crear`; `createRecorridoAction`/`anularRecorridoAction` → `recorridos.gestionar`.
  - Con sesión obligatoria: resto de acciones (aprobar/devolver las usa el rol AGENCIA,
    que no posee `recorridos.gestionar`; catálogos no tiene códigos de permiso definidos —
    granularidad adicional registrada en RADAR como mejora acordable).
- **Evidencia:** tests unitarios de `requireSession` (rechazo sin cookie y con JWT
  corrupto; retorno de payload con sesión válida) + test estático que exige guard en
  el cuerpo de **cada** función exportada de las actions (falla si se añade una action
  sin guard). Smoke E2E en build de producción: login `admin`, creación de empresa de
  mensajería y registro de correspondencia entrante exitosos con los guards activos.

### SEC-004 — API de uploads sin autenticación — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado: el matcher del middleware excluye `/api`.
- **Remediación:** verificación explícita del JWT de sesión (cookie `session`) al inicio
  de `GET /api/uploads`; sin token o con token inválido responde `401 Unauthorized`
  antes de tocar el sistema de archivos.
- **Evidencia:** tests automatizados (`401` sin cookie, `401` con JWT inválido, y con
  sesión válida NO `401`) + smoke E2E sobre build de producción:
  `curl /api/uploads?filename=doc.pdf` → `401`; misma petición autenticada → `400`
  (directorio no configurado, comportamiento esperado).

### SEC-005 — `bcryptjs` y `cookie` en devDependencies — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado (`package.json:41-42`).
- **Remediación:** `bcryptjs` y `cookie` movidos a `dependencies`; `@types/bcryptjs`
  permanece en `devDependencies`.
- **Evidencia:** test `tests/security/package-deps.test.ts` (falla si vuelven a devDeps);
  build de producción y `npm ci` correctos.

### SEC-006 — Subida de archivos sin validación de tipo ni tamaño — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado.
- **Remediación:** módulo central `src/lib/uploads.ts` — `validateUploadFile()` con whitelist
  de MIME (PDF/PNG/JPG), verificación de que la extensión corresponde al MIME, y tamaño
  máximo de 10 MB. Todas las subidas pasan por `saveUploadedFile()` (resuelve también SEC-017).
- **Evidencia:** 5 casos en `tests/security/uploads-validation.test.ts` (acepta válidos;
  rechaza >10 MB, ejecutables, HTML y extensión/MIME incoherentes).

### SEC-007 — Esquemas Zod definidos pero no usados en server actions — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado: 0 usos de `safeParse` en `actions/`.
- **Remediación:** `safeParse()` integrado en `registerIncomingMail`, `registerOutgoingMail`
  (esquemas de `correspondencia`) y en `saveEmpresaConfigAction`, `createUserAction`,
  `updateUserAction` (esquemas de `admin`), con manejo de error homogéneo.
- **Evidencia:** test estático `tests/security/zod-integration.test.ts` que exige `safeParse`
  y el uso de cada esquema.

### SEC-008 — Cookie de sesión sin atributos seguros — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado en `src/lib/auth.ts` (`updateSession`, `logout`).
- **Remediación:** constante única `SESSION_COOKIE_OPTIONS` (`httpOnly + secure + sameSite:"lax"
  + path:"/"`) aplicada en las **tres** operaciones: crear (login), refrescar (updateSession)
  y limpiar (logout).
- **Evidencia:** `tests/security/cookie-attrs.test.ts` verifica los atributos en refresh y clear.

### SEC-009 — Sin rate limiting en login — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado (además ya constaba en el RADAR interno de AISerNet).
- **Remediación:** `src/lib/rate-limit.ts` (ventana fija, máx. 5 intentos/60s por usuario)
  integrado en `loginAction`. Para despliegue multi-instancia se migrará a Redis (RADAR).
- **Evidencia:** 4 tests unitarios (`rate-limit.test.ts`) + **verificación E2E decisiva**:
  ruta temporal invocada 7 veces sobre el build de producción → permite 5, bloquea del 6º
  (`allowed:false, retryAfterSeconds:60`); ruta temporal eliminada tras la prueba.

### SEC-010 — SVG sin sanitización (XSS almacenado) — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado (`api/uploads/route.ts` servía `image/svg+xml` inline).
- **Remediación:** doble defensa — (1) SVG excluido de la whitelist de subida (SEC-006);
  (2) `GET /api/uploads` solo sirve inline los tipos seguros (PDF/PNG/JPG/GIF); cualquier
  otro se fuerza con `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`,
  de modo que un SVG con `<script>` nunca se ejecuta.
- **Evidencia:** `uploads-validation.test.ts` (SVG rechazado en subida) + inspección del handler.

### SEC-011 — Falta Content-Security-Policy — **✅ RESUELTO**
- **Remediación:** header CSP en `next.config.ts` (`default-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'self'`, etc.).
- **Evidencia:** `tests/security/headers.test.ts` + `curl -I` sobre producción muestra el header.

### SEC-012 — Falta Strict-Transport-Security — **✅ RESUELTO**
- **Remediación:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Evidencia:** `headers.test.ts` + `curl -I` sobre producción muestra el header.

### SEC-013 — Uso de `any` en funciones de autenticación — **✅ RESUELTO**
- **Remediación:** interfaz `SessionPayload` tipando `encrypt`, `decrypt`, `getSession`;
  se eliminó `any`. El componente `LayoutWrapper` reutiliza el mismo tipo.
- **Evidencia:** build de producción con TypeScript strict en verde.

### SEC-014 — Bloques catch vacíos — **✅ RESUELTO**
- **Verificación ASIA:** Confirmado (`correspondencia.ts`).
- **Remediación:** los `catch (e) {}` de parseo de anexos ahora registran con `console.warn`
  (mensaje, sin interrumpir el flujo); lógica unificada en `buildAnexosCreate`.
- **Evidencia:** revisión de código; sin `catch` vacíos en `src/`.

### SEC-015 — `console.error` expone detalles internos — **✅ RESUELTO**
- **Remediación:** todo el logging de errores en `actions/` y `api/` se limitó a
  `error.message` (no el objeto/stack completo).
- **Evidencia:** revisión de código (`grep` sin `console.error(error)` crudo).

### SEC-016 — Se usa npm en vez de pnpm — **⚪ EXCEPCIÓN JUSTIFICADA (aceptación de riesgo)**
- **Naturaleza del hallazgo:** es una **convención de herramienta**, no una vulnerabilidad.
  npm es el gestor de paquetes oficial incluido en Node.js; una aplicación instalada con npm
  no tiene menor postura de seguridad que una instalada con pnpm. El propio hallazgo se basa
  en la presencia de `package-lock.json` (npm) en lugar de `pnpm-lock.yaml`.
- **Decisión ASIA (acordada con la dirección de AISerNet):** se **mantiene npm**. Motivos:
  (1) no cierra ningún vector de seguridad; (2) la cadena de build y despliegue de SISMAR ya
  está validada extremo a extremo con `npm ci` / `npm run build`, incluida la coexistencia con
  otro sistema en el mismo VPS; migrar introduciría riesgo operativo sin beneficio de seguridad.
  El `package-lock.json` fija versiones exactas y garantiza instalaciones reproducibles, que es
  el objetivo real del control.
- **Solicitud a FOSCAL:** aceptar esta excepción. Si el uso de pnpm es un requisito contractual
  firme, se planificará como cambio controlado independiente, fuera del alcance de esta
  remediación de seguridad.
- **Evidencia:** `package-lock.json` versionado (instalaciones reproducibles); pipeline de
  despliegue documentado en `docs/DEPLOY_VPS_HOSTINGER_SISMAR.md`.

### SEC-017 — Lógica de upload duplicada — **✅ RESUELTO**
- **Remediación:** las 3 copias del código de subida se reemplazaron por
  `saveUploadedFile()` de `src/lib/uploads.ts` (única fuente de verdad).
- **Evidencia:** revisión de código; los tests de `uploads-validation` cubren el módulo único.

### SEC-018 — Operaciones DB secuenciales en bucle (N+1) — **✅ RESUELTO**
- **Remediación:** `prisma.recorridoPlanilla.createMany()` (2 bucles en `recorridos.ts`) y
  `prisma.rolPermiso.createMany()` (`seed.ts`), una sola query por lote.
- **Evidencia:** revisión de código; seed ejecutado correctamente sobre PostgreSQL.

### SEC-019 — `Date.now()` como consecutivo puede colisionar — **✅ RESUELTO**
- **Remediación:** `src/lib/consecutive.ts` — `generateConsecutive()` combina timestamp
  (ordenable) con sufijo aleatorio (UUID) criptográfico. Usado en entrante y saliente.
- **Evidencia:** `tests/security/consecutive.test.ts` (500 valores concurrentes, 0 colisiones).

### SEC-020 — Contraseña mínima de solo 6 caracteres — **✅ RESUELTO**
- **Remediación:** política en `lib/schemas/admin.ts` — mínimo 8 caracteres con mayúscula,
  minúscula y número (NIST). Aplica a creación y a cambio de contraseña.
- **Evidencia:** `tests/security/password-policy.test.ts` (rechaza 6 chars y 8-sin-complejidad;
  acepta complejas; el update permite vacío = "no cambiar").

---

## 4. Verificación final (Gate BDD)

- [x] **37 tests automatizados en verde** (auth guards, validación de uploads, esquemas Zod,
      atributos de cookie, rate limit, headers, política de contraseñas, consecutivos).
- [x] **Build de producción sin errores** (TypeScript strict).
- [x] **Smoke E2E** sobre el build de producción: login `admin`, registro de correspondencia
      con guards y validación Zod activos, `401` en uploads sin sesión, headers CSP/HSTS
      presentes, rate limit bloqueando al 6º intento.
- [x] Re-chequeo uno a uno de los 20 hallazgos (este documento).
- [x] Ningún despliegue a pre-producción durante la remediación.

**Resumen:** 19/20 hallazgos remediados y verificados; SEC-016 respondido como excepción
justificada. Recomendación de AISerNet: **apto para retomar el despliegue a pre-producción**
una vez rotadas las credenciales de los usuarios semilla.

### Paso operativo — rotación de contraseñas de usuarios semilla
Se incluye el script `prisma/rotate-passwords.ts`, que reemplaza la contraseña por defecto
(la por defecto del seed) por una contraseña fuerte y aleatoria (16 caracteres, cumple la política SEC-020),
con hash bcrypt (coste 12). Ejecutar en el servidor tras el primer arranque:

```bash
npx tsx prisma/rotate-passwords.ts            # rota admin, mensajero, gerencia, talento
```

Las nuevas contraseñas se muestran **una sola vez** en pantalla (no se escriben a disco ni a
logs); deben guardarse en un gestor seguro. Verificado (E2E sobre PostgreSQL): tras la rotación,
la contraseña por defecto deja de ser válida y la nueva contraseña autentica correctamente.

---

*By AISerNet Company — Equipo ASIA · Metodología STRATA v3*
