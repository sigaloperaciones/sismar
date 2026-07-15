# Respuesta a la Auditoría de Seguridad Estática (SAST) — SISMAR

**De:** AISerNet Company — Equipo ASIA (Arquitectura de Soluciones de Inteligencia Artificial)
**Para:** FOSCAL — Equipo de Ciberseguridad
**Referencia:** Auditoría SAST SISMAR del 14 de julio de 2026 (20 hallazgos: 4 críticos, 6 altos, 8 medios, 2 bajos)
**Estado del documento:** EN CURSO — se actualiza con evidencia por cada hallazgo remediado.

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
| 2 | Altos | SEC-005 … SEC-010 | PENDIENTE |
| 3 | Medios | SEC-011 … SEC-018 | PENDIENTE |
| 4 | Bajos + verificación integral | SEC-019, SEC-020 + re-chequeo 20/20 | PENDIENTE |

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

### SEC-005 — `bcryptjs` y `cookie` en devDependencies — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado (`package.json:41-42`).
- **Remediación prevista:** mover ambos a `dependencies` (`@types/bcryptjs` permanece en dev).
- **Evidencia:** _pendiente_

### SEC-006 — Subida de archivos sin validación de tipo ni tamaño — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado.
- **Remediación prevista:** módulo central `src/lib/uploads.ts` con whitelist de MIME/extensión
  (PDF, PNG, JPG) y tamaño máximo 10 MB. Resuelve también SEC-017 (duplicación).
- **Evidencia:** _pendiente_

### SEC-007 — Esquemas Zod definidos pero no usados en server actions — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado: 0 usos de `safeParse` en `actions/`.
- **Remediación prevista:** `schema.safeParse()` en todas las server actions con manejo
  de error homogéneo.
- **Evidencia:** _pendiente_

### SEC-008 — Cookie de sesión sin atributos seguros — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado en `src/lib/auth.ts` (`updateSession`, `logout`).
- **Remediación prevista:** `httpOnly + secure + sameSite: "lax" + path: "/"` en **todas**
  las operaciones de cookie de sesión.
- **Evidencia:** _pendiente_

### SEC-009 — Sin rate limiting en login — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado (además ya constaba en el RADAR interno de AISerNet).
- **Remediación prevista:** rate limiter en `loginAction` (máx. 5 intentos/minuto por
  usuario/IP, en memoria para instancia única; anotada migración a Redis si se escala).
- **Evidencia:** _pendiente_

### SEC-010 — SVG sin sanitización (XSS almacenado) — ⏳ PLANIFICADO (Pulso 2)
- **Verificación ASIA:** Confirmado (`api/uploads/route.ts` sirve `image/svg+xml` inline).
- **Remediación prevista:** SVG excluido de la whitelist de subida (SEC-006) y, como defensa
  en profundidad, `Content-Disposition: attachment` para cualquier tipo no incluido en whitelist.
- **Evidencia:** _pendiente_

### SEC-011 — Falta Content-Security-Policy — ⏳ PLANIFICADO (Pulso 3)
- **Remediación prevista:** header CSP en `next.config.ts` restringiendo scripts/estilos/imágenes.
- **Evidencia:** _pendiente_

### SEC-012 — Falta Strict-Transport-Security — ⏳ PLANIFICADO (Pulso 3)
- **Remediación prevista:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Evidencia:** _pendiente_

### SEC-013 — Uso de `any` en funciones de autenticación — ⏳ PLANIFICADO (Pulso 3)
- **Remediación prevista:** interfaz `SessionPayload` tipando `encrypt`/`decrypt`.
- **Evidencia:** _pendiente_

### SEC-014 — Bloques catch vacíos — ⏳ PLANIFICADO (Pulso 3)
- **Verificación ASIA:** Confirmado (`correspondencia.ts:54,157,270`).
- **Remediación prevista:** registro con `console.warn` (sin interrumpir el flujo).
- **Evidencia:** _pendiente_

### SEC-015 — `console.error` expone detalles internos — ⏳ PLANIFICADO (Pulso 3)
- **Remediación prevista:** logging limitado a `error.message` en producción.
- **Evidencia:** _pendiente_

### SEC-016 — Se usa npm en vez de pnpm — 💬 EN DISCUSIÓN
- **Posición ASIA:** el cambio de gestor de paquetes afecta la cadena de build y despliegue
  ya validada (scripts de aprovisionamiento con `npm ci`). Proponemos acordar con FOSCAL el
  alcance y momento de la migración para no introducir riesgo operativo durante la
  remediación de seguridad. Se ejecutará como cambio controlado independiente.
- **Evidencia:** _pendiente de acuerdo_

### SEC-017 — Lógica de upload duplicada — ⏳ PLANIFICADO (Pulso 3, junto a SEC-006)
- **Remediación prevista:** extracción a `src/lib/uploads.ts` (única fuente de verdad).
- **Evidencia:** _pendiente_

### SEC-018 — Operaciones DB secuenciales en bucle (N+1) — ⏳ PLANIFICADO (Pulso 3)
- **Remediación prevista:** `prisma.createMany()` en `recorridos.ts` y `seed.ts`.
- **Evidencia:** _pendiente_

### SEC-019 — `Date.now()` como consecutivo puede colisionar — ⏳ PLANIFICADO (Pulso 4)
- **Remediación prevista:** generación con CUID (o `@default(cuid())` en Prisma).
- **Evidencia:** _pendiente_

### SEC-020 — Contraseña mínima de solo 6 caracteres — ⏳ PLANIFICADO (Pulso 4)
- **Remediación prevista:** mínimo 8 caracteres con complejidad (mayúscula, minúscula, número)
  en `lib/schemas/admin.ts`, alineado con NIST.
- **Evidencia:** _pendiente_

---

## 4. Verificación final (Gate BDD — al cierre)

- [ ] Suite de tests automatizados en verde (los guards de auth, validación de uploads,
      esquemas Zod y atributos de cookie tienen test dedicado).
- [ ] Build de producción sin errores.
- [ ] Smoke E2E: login, módulos de correspondencia/planillas/admin operativos.
- [ ] Re-chequeo uno a uno de los 20 hallazgos con evidencia adjunta.
- [ ] Ningún despliegue a pre-producción antes del cierre de críticos y altos.

---

*By AISerNet Company — Equipo ASIA · Metodología STRATA v3*
