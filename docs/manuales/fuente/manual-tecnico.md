---
titulo: Manual Técnico
producto: SISMAR
descripcion: Sistema de Gestión de Correspondencia Interna
version_manual: 1.0
version_producto: 0.1.0
fecha: 2026-10-01
lector: Equipo que mantiene, extiende y opera el código de SISMAR (desarrollo, Guardian, soporte de segundo nivel).
base: Código de la rama fix/ajustes-cliente-post-piloto-2 al 2026-10-01, con el Flujo STRATA H-003 aplicado. Suite de tests ejecutada el 2026-10-01 tras la revisión Guardian (30 archivos, 252 tests en verde).
---

## Historial de cambios

| Versión | Fecha | Origen | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-01 | Flujo H-003 (cierre) y revisión Guardian R-027…R-047 | Creación del manual: arquitectura, modelo de datos, sesión revocable, autorización con tenencia, archivos privados, CSP con nonce, bitácora, pruebas, operación y trazabilidad a Contratos C-001…C-016. |

## 1. Alcance de este documento

Este manual describe **cómo está construido SISMAR hoy** y cómo mantenerlo sin romper sus controles. Cada afirmación se contrastó con el código fuente de la rama indicada en la portada. Donde el código no respalda algo, el texto lo marca como **Planificado** o lo omite.

Documentos relacionados en el repositorio:

| Documento | Ruta |
|---|---|
| Spec del Flujo H-003 (STR-A09) | `specs/H-003-remediacion-auditoria-2/spec.md` |
| Threat model y abuse cases (STR-A13) | `specs/H-003-remediacion-auditoria-2/threat-model.md` |
| Contratos C-001…C-016 | `specs/H-003-remediacion-auditoria-2/contracts.yaml` |
| Escenarios BDD (STR-A10) | `specs/H-003-remediacion-auditoria-2/scenarios/*.feature` |
| Respuesta formal a la auditoría N.º 2 | `docs/auditoria/RESPUESTA_AUDITORIA_2_SISMAR.md` |
| RADAR (STR-A05), acta de cierre (STR-A03) y cobertura (STR-A12) | `artefacts/H-003/` |
| Runbook de operación (genérico, sin secretos) | `docs/OPERACION.md` |
| Manual de Implementación en Cliente | `docs/manuales/manual-implementacion-cliente.docx` |

## 2. Arquitectura

### 2.1 Stack

| Capa | Tecnología | Versión declarada (`package.json`) |
|---|---|---|
| Frontend | Next.js App Router, React, Tailwind CSS, Radix UI | `next` 16.3.8 (versión exacta, R-045) · `react` 19.2.1 · Tailwind 4 |
| Backend | Server Actions y Route Handlers de Next.js; Zod; `jose` (JWT HS256); `bcryptjs` | `zod` ^4.3.6 · `jose` ^6.1.3 · `bcryptjs` ^3.0.3 |
| Datos | PostgreSQL + Prisma ORM | `@prisma/client` y `prisma` ^5.10.2 · PostgreSQL 16 (imagen `postgres:16-alpine` en `docker-compose.prod.yml`) |
| Pruebas | Vitest | `vitest` ^4.1.10 (ejecutado: v4.1.10) |
| Ejecución | Node.js 20 o superior, PM2, proxy inverso con TLS | `deploy/ecosystem.config.cjs`, `deploy/Caddyfile.sismar` |

`package.json` fija además `overrides.nanoid ^3.3.18` (dependencia transitiva). La revisión Guardian registró `npm audit --omit=dev` con 0 vulnerabilidades tras subir de Next 16.0.8 a 16.3.8 (R-027, AC-017).

### 2.2 Topología de ejecución

![Figura 1. Topología de ejecución: solo el proxy está expuesto; Node y PostgreSQL escuchan en loopback.](../img/arquitectura.png)

- El proxy inverso termina TLS y es el único proceso expuesto a internet.
- Node escucha solo en loopback: `next start -H 127.0.0.1` (ver `deploy/ecosystem.config.cjs`).
- PostgreSQL publica su puerto solo en `127.0.0.1` (ver `docker-compose.prod.yml`).
- Los archivos subidos viven en un directorio privado (`UPLOADS_DIR`), fuera de `public/`.

### 2.3 Capas STRATA en el código

| Capa | Código | Dónde vive | Responsabilidad |
|---|---|---|---|
| Visible | `VIS` | `src/app/(auth)`, `src/app/(dashboard)`, `src/components` | Pantallas, formularios (react-hook-form + Zod), menú por permisos, pantalla *Acceso denegado*. La UI **refleja** permisos; nunca los decide. |
| Lógico | `LOG` | `src/app/actions/*.ts`, `src/app/api/**`, `src/lib/*.ts` | Server actions con guard, validación Zod, tenencia, reglas de estado de planillas y recorridos, bitácora. |
| Persistente | `PER` | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/*.ts` | Modelo, enums, índices, migraciones, seed no destructivo, scripts operativos. |
| Guardian | `GRD` | `src/middleware.ts`, `src/lib/auth-guard.ts`, `tenancy.ts`, `session-store.ts`, `uploads.ts`, `upload-access.ts`, `csp.ts`, `request-origin.ts`, `rate-limit.ts`, `login-policy.ts`, `tests/security/` | Sesión revocable, autorización en el núcleo, archivos con ACL, cabeceras, rate limit, pruebas de seguridad. Transversal. |

### 2.4 Estructura del repositorio

```
src/app/(auth)/login              Pantalla de acceso (cliente)
src/app/(dashboard)/              Módulos: inicio, correspondencia, mi-correspondencia,
                                  planillas, recorridos, reportes, admin/*
src/app/actions/                  Server actions: auth, correspondencia, planillas,
                                  recorridos, admin, catalogos
src/app/api/uploads/route.ts      Entrega de archivos con sesión y ACL por objeto
src/app/api/auth/expired/route.ts Limpieza de cookie de sesión inválida
src/components/                   UI (shadcn/Radix), formularios, AccessDenied, ThemeInjector
src/lib/                          Guards, sesión, tenencia, permisos, archivos, CSP,
                                  rate limit, bitácora, notificaciones, CSV, esquemas Zod
src/middleware.ts                 Puerta rápida (JWT), CSP con nonce, bloqueo /uploads
prisma/                           Schema, migraciones, seed y scripts operativos
specs/H-NNN-*/                    Artefactos STRATA del Flujo (Spec, threat model,
                                  contratos, escenarios)
tests/security/                   Suite de seguridad (Vitest)
tests/e2e/                        Prueba manual de bypass RSC (no corre con npm test)
artefacts/H-NNN/                  RADAR, acta de cierre y reporte de cobertura del Flujo
deploy/                           PM2, fragmento de Caddy y script de aprovisionamiento
docs/                             Operación, auditorías, manuales
```

### 2.5 Por qué toda la aplicación se renderiza de forma dinámica

`src/app/layout.tsx` declara `export const dynamic = "force-dynamic"`. La CSP lleva un **nonce distinto en cada petición** y Next.js solo inyecta ese nonce en sus `<script>` cuando la página se renderiza por petición. Una página prerenderizada tendría scripts sin nonce y el navegador los bloquearía. SISMAR es 100 % autenticado, así que el prerender no aporta valor.

El layout raíz lee el nonce de la cabecera `x-nonce` (la fija el middleware) y se lo pasa a `ThemeProvider` de `next-themes`, que inserta un script inline propio.

> **Regla de mantenimiento.** No agregue `export const dynamic = "force-static"` ni `generateStaticParams` en páginas de la app: rompería la CSP con nonce (C-010).

## 3. Modelo de datos

### 3.1 Enums

Desde H-003 (C-013) la integridad de dominio vive en la base de datos, no solo en Zod.

| Enum | Valores | Usado en |
|---|---|---|
| `Role` | `ADMIN`, `MENSAJERO`, `AGENCIA` | `Usuario.role`, `RolPermiso.rol` |
| `TipoCorrespondencia` | `ENTRANTE`, `SALIENTE` | `Correspondencia.tipo`, `Planilla.tipo` |
| `Importancia` | `NORMAL`, `ALTA` | `Correspondencia.importancia` |
| `EstadoCorrespondencia` | `POR_ENTREGAR`, `ENTREGADA`, `DEVUELTA` | `Correspondencia.estado` |
| `EstadoPlanilla` | `GENERADA`, `CERRADA`, `PROCESADA` | `Planilla.estado` |
| `TipoRecorrido` | `AM`, `PM`, `EXCEPCIONAL` | `Recorrido.tipo` |
| `EstadoRecorrido` | `INICIADO`, `TERMINADO`, `ANULADO` | `Recorrido.estado` |

Para convertir texto externo (query string, `FormData`) a enum use `asEnum()` de `src/lib/enums.ts`: devuelve `undefined` si el valor no pertenece al dominio.

### 3.2 Entidades

| Modelo | Propósito | Campos y relaciones clave |
|---|---|---|
| `Sede` | Ubicación física. | `name`, `address?`; 1-N `Agencia`. |
| `CentroCosto` | Unidad contable. | `code` único (correlativo `001`, `002`… calculado por `nextCentroCostoCode`), `name`. |
| `Agencia` | Dependencia que envía y recibe. | `name`, `sedeId`, `centroCostoId`, `email?`; usuarios, correspondencia (`"Destinatario"`), planillas. |
| `EmpresaMensajeria` | Transportadora. | `nombre` único, `activo`, `nombreMensajero?`, `rutasPersonalizadas` (solo informativo). |
| `Ciudad` | Catálogo de ciudades. | `codigo` único (5-7), `nombre`, `departamento`. La correspondencia guarda la ciudad como texto, sin FK. |
| `Usuario` | Cuenta. | `username` único, `email?`, `password` (bcrypt), `role`, `agenciaId?`, `failedLoginAttempts`, `lockedUntil?`. |
| `Sesion` | Sesión revocable (sección 3.3). | `id` (= `sid`), `usuarioId` (FK `onDelete: Cascade`), `expiresAt`, `revokedAt?`, `lastSeenAt`, `ip?`, `userAgent?`. |
| `AuditLog` | Bitácora append-only (sección 3.4). | `fecha`, `usuarioId?` (FK `onDelete: SetNull`), `username?`, `accion`, `entidad?`, `entidadId?`, `detalle` JSON, `ip?`. |
| `TipoAnexo` | Catálogo de tipos de anexo. | `name` único. El seed crea: Documento, Paquete, CD, USB, Contrato, Tutela, Factura, Otro. No hay pantalla de administración. |
| `Correspondencia` | Pieza entrante o saliente. | `consecutive`, `tipo`, `fechaRecepcion`, remitente/destinatario, `asunto`, `importancia`, `necesitaRespuesta`, `estado`, `agenciaId`, guía (`numeroGuia`, `mensajero`, `guiaUrl`), `planillaId?`, `fechaEntrega?`, `recibidoPor?`, observaciones, autoría. |
| `Anexo` / `AnexoDetalle` | Anexos de una pieza e identificadores por unidad. | `tipoAnexoId`, `cantidad`; `identificador` (cascade desde `Anexo`). |
| `Planilla` | Agrupación para entrega. | `agenciaId?` (null en salientes), `estado`, `tipo`, `documentoFirmaUrl?`, `createdBy?`. |
| `Recorrido` / `RecorridoPlanilla` | Salida de mensajería y su relación N-N con planillas. | `tipo`, `estado`, `notas?`, `creadoPor?`; único `(recorridoId, planillaId)`. |
| `EmpresaConfig` | Configuración y marca. | `nombre`, `nit?`, `logoUrl?`, `uploadsDir?` (sin UI), colores HSL. La app usa la fila con `id = 1`. |
| `Permiso` / `RolPermiso` / `UsuarioPermiso` | Permisos granulares. | Catálogo por `codigo`; default por rol; override por usuario (sección 5.2). |

### 3.3 Sesion

- La crea `createSession()` en el login con un `id` aleatorio (`randomUUID`) y `expiresAt = ahora + 24 h`.
- `resolveSession(sid)` es la **única fuente de verdad** para autorizar: devuelve `null` si la sesión no existe, está revocada, expiró o el usuario ya no existe. Si no, devuelve el usuario con **rol y agencia frescos**.
- `lastSeenAt` se actualiza como máximo una vez cada 5 minutos, sin bloquear la petición.
- `purgeSessions(olderThanDays = 7)` borra sesiones expiradas o revocadas antiguas. **No hay script ni tarea programada que la invoque**; la limpieza se hace por SQL (sección 15.3).

### 3.4 AuditLog

- La escribe `audit()` (`src/lib/audit.ts`). **Nunca interrumpe la operación**: si falla, registra solo el mensaje en consola y continúa.
- La aplicación no hace `UPDATE` ni `DELETE` sobre esta tabla: es append-only **por convención** (R-042). Para hacerlo exigible en la base, `docs/OPERACION.md` recomienda conectar la app con un rol distinto del propietario y ejecutar `REVOKE UPDATE, DELETE ON "AuditLog" FROM <rol_app>;`.
- Al borrar un usuario, sus filas se conservan con `usuarioId = NULL` y `username` intacto.
- En los intentos de login con un usuario **inexistente** y en `LOGIN_LIMITADO`, `username` no guarda el texto tecleado (podría ser una contraseña escrita en el campo equivocado) sino `anonymizeUsername()`: `usuario#` + 16 caracteres de un HMAC-SHA256 con clave derivada de `JWT_SECRET` (R-042, R-044). Permite correlacionar intentos, no leerlos. Si se rota `JWT_SECRET`, los identificadores nuevos dejan de coincidir con los anteriores.
- `CORRESPONDENCIA_EDITAR` guarda en `detalle.antes` los valores previos de la pieza (R-034), para reconstruir su historia.
- Si no se pasa `ip`, `audit()` la toma de las cabeceras con `getClientIp()` (último valor de `X-Forwarded-For`, luego `X-Real-IP`).

Acciones registradas (`AuditAction`):

| Grupo | Acciones |
|---|---|
| Acceso | `LOGIN_OK`, `LOGIN_FALLIDO`, `LOGIN_BLOQUEADO`, `LOGIN_LIMITADO`, `LOGOUT`, `SESIONES_REVOCADAS` (script de rotación) |
| Denegaciones | `ACCESO_DENEGADO`, `ARCHIVO_DENEGADO` |
| Correspondencia | `CORRESPONDENCIA_CREAR`, `CORRESPONDENCIA_EDITAR`, `CORRESPONDENCIA_APROBAR`, `CORRESPONDENCIA_DEVOLVER`, `ARCHIVO_SUBIR` |
| Planillas | `PLANILLA_GENERAR`, `PLANILLA_CERRAR`, `PLANILLA_REABRIR`, `PLANILLA_PROCESAR`, `PLANILLA_RETIRAR_ITEM`, `PLANILLA_FIRMA` |
| Recorridos | `RECORRIDO_CREAR` (también al agregar planillas), `RECORRIDO_ANULAR` |
| Administración | `CATALOGO_CREAR`, `CATALOGO_EDITAR`, `CATALOGO_ELIMINAR`, `USUARIO_CREAR`, `USUARIO_EDITAR`, `USUARIO_ELIMINAR`, `PERMISOS_EDITAR`, `CONFIG_EDITAR` |

### 3.5 Autoría

| Campo | Se llena en |
|---|---|
| `Correspondencia.createdBy` | `registerIncomingMail`, `registerOutgoingMail` |
| `Correspondencia.updatedBy` | `updateMailAction`, cierre y reapertura de planilla saliente, retiro de planilla, aprobar, devolver |
| `Correspondencia.recibidoPor` | `aprobarCorrespondenciaAction` |
| `Planilla.createdBy` | `generatePlanillaAction` |
| `Recorrido.creadoPor` | `createRecorridoAction` |

Todos guardan el `username` del contexto de autenticación leído de la base de datos.

### 3.6 Convenciones del modelo

- **Destinatario de salientes.** En salientes, `remitenteNombre` y `remitenteCiudad` guardan el **destinatario externo** y su ciudad. `updateMailSchema` acepta ambos pares de nombres y la acción los normaliza.
- **Consecutivo.** `generateConsecutive(prefix)` produce `<timestamp>-<8 hex en mayúscula>`; las salientes usan el prefijo `SAL-`. El número de planilla visible es su `id`.
- **Planilla saliente compartida.** Las salientes agrupan piezas de varias agencias y tienen `agenciaId = null`; la tenencia se evalúa por las piezas que contienen (sección 5.4).
- **Índices** (C-013): `Correspondencia(estado, tipo, agenciaId)`, `(agenciaId)`, `(planillaId)`, `(createdAt)`; `Planilla(estado, tipo)`, `(agenciaId)`; `Recorrido(estado)`; `Sesion(usuarioId)`, `(expiresAt)`; `AuditLog(fecha)`, `(usuarioId)`, `(entidad, entidadId)`.

### 3.7 Migraciones

| Migración | Contenido |
|---|---|
| `20260625174314_init` | Esquema inicial (17 tablas, columnas de dominio como `TEXT`). |
| `20261001120000_h003_seguridad_autorizacion` | **Escrita a mano.** Enums, columnas de autoría y bloqueo, tablas `Sesion` y `AuditLog`, índices y FKs. |
| `20261001133000_h003_recorrido_unico_activo` | **Escrita a mano** (R-041). Índice único **parcial** `Recorrido_unico_iniciado_idx` sobre `Recorrido(estado) WHERE estado = 'INICIADO'`: a lo sumo un recorrido en curso. Antes de crearlo aborta si ya hay más de uno `INICIADO`. |

La migración H-003 convierte cada columna con `ALTER COLUMN … TYPE "Enum" USING (col::"Enum")`, que **conserva los datos**. Antes de convertir, un bloque `DO $$ … $$` busca valores fuera del dominio y, si los hay, aborta con `RAISE EXCEPTION 'H-003: valores fuera del dominio…'` y la lista exacta de valores. La migración es transaccional: si aborta, no cambia nada.

> **Regla de mantenimiento.** No regenere estas migraciones con `prisma migrate dev`: el SQL autogenerado hace `DROP COLUMN` + `ADD COLUMN` y **pierde los datos** de las columnas convertidas. Prisma no modela índices parciales: si `migrate dev` propone eliminar `Recorrido_unico_iniciado_idx` por *drift*, **no lo acepte**. Para cambios futuros de tipo, escriba el SQL a mano con `USING`.

## 4. Autenticación y sesión

### 4.1 Flujo de login

`loginAction` (`src/app/actions/auth.ts`, C-001 y C-008):

1. Normaliza la entrada: usuario recortado; rechaza usuario de más de 60 caracteres o contraseña de más de 200 con el mensaje genérico.
2. Aplica `checkLoginRateLimits(username, ip)`: 5 intentos por minuto por usuario y 20 por minuto por IP. Si se excede, responde *Demasiados intentos. Espere N segundos…* y audita `LOGIN_LIMITADO` con el usuario anonimizado.
3. Busca el usuario. Si **no existe** o está **bloqueado**, ejecuta igualmente `bcrypt.compare` contra `DUMMY_BCRYPT_HASH` (tiempo constante) y responde *Credenciales inválidas*.
4. Si la contraseña falla, aplica `afterFailedLogin()`: al llegar a **10 fallos consecutivos** fija `lockedUntil = ahora + 15 min`. Audita `LOGIN_FALLIDO` o `LOGIN_BLOQUEADO`.
5. Si es correcta, reinicia el contador. Si el hash guardado tiene coste menor que `BCRYPT_COST` (12), lo re-hashea a coste 12 en ese momento (`needsRehash`, R-032): un hash heredado de coste 10 respondería más rápido que el de relleno y delataría la cuenta. Luego crea la `Sesion` y emite el JWT.
6. Escribe la cookie y audita `LOGIN_OK` con el `sid`.

**JWT** (`src/lib/auth.ts`): HS256 con `JWT_SECRET`, expiración absoluta de 24 h. El payload lleva `sid`, `userId`, `username`, `role` y `agenciaId`. **Solo `sid` y `userId` cuentan**: `role` y `agenciaId` son pistas para la UI y nunca se usan para autorizar.

**Cookie** (`src/lib/session-cookie.ts`): nombre `session`, `httpOnly`, `sameSite: lax`, `path: /` y `secure` cuando `NODE_ENV === "production"`. Set, clear y la limpieza del middleware usan los **mismos atributos** (B-01). `src/lib/auth.ts` lanza un error al importarse si `JWT_SECRET` no está definida.

### 4.2 Validación en cada petición

1. **Middleware (Edge, sin base de datos).** Verifica la firma del JWT y que traiga `userId` numérico y `sid`. Sin token válido redirige a `/login` y limpia la cookie. No re-firma ni renueva el token. La única ruta pública es `/login`, comparada de forma **exacta** (R-042: antes una comparación por prefijo abría rutas como `/loginx`).
2. **Servidor.** `requireSession()` (`src/lib/auth-guard.ts`) decodifica el JWT, resuelve la sesión con `resolveSession(sid)` y comprueba que el `userId` del token coincida con el de la sesión. Devuelve un `AuthContext { userId, username, role, agenciaId, sid }` con datos frescos de la base.
3. El layout `src/app/(dashboard)/layout.tsx` llama `requireSession()` y construye el menú con `getUserPermissions()`. **El layout no es una frontera de seguridad** (R-028, AC-016): una petición RSC con `Next-Router-State-Tree` puede declarar los layouts como ya renderizados y el servidor ejecuta solo la página. Por eso **cada** `page.tsx` invoca su propio guard antes de tocar Prisma (sección 5.6).

### 4.3 Revocación

| Evento | Efecto | Dónde |
|---|---|---|
| Logout | `revokedAt = ahora` en la sesión actual; audita `LOGOUT`. | `logoutAction` |
| Cambio de rol, agencia o contraseña de un usuario | `revokeAllSessions(userId)`. | `updateUserAction` |
| Eliminación de usuario | Las sesiones se borran por FK en cascada. | `deleteUserAction` |
| Rotación por script | Revoca todas las sesiones del usuario y audita `SESIONES_REVOCADAS`. | `prisma/rotate-passwords.ts` |
| Incidente | `UPDATE "Sesion" SET "revokedAt" = now() WHERE "revokedAt" IS NULL;` y/o rotar `JWT_SECRET`. | Operación (sección 15.3) |

### 4.4 Ruta `/api/auth/expired`

Un Server Component no puede escribir cookies. Si `requireSession()` detecta una cookie cuya sesión ya no vale, redirige a `GET /api/auth/expired`. La ruta:

- borra la cookie con los mismos atributos de seguridad;
- responde `303` hacia `/login?expired=1` con `Cache-Control: no-store`;
- usa `resolveOrigin()` para construir la URL (C-009).

En `/login?expired=1` el middleware **no** reenvía a `/` aunque el navegador conserve un JWT válido. Así se evita el bucle middleware ↔ servidor detectado durante la verificación de H-003. La pantalla de login muestra *Su sesión expiró o fue cerrada. Ingrese nuevamente.*

### 4.5 Constantes de sesión y login

| Constante | Valor | Archivo |
|---|---|---|
| `SESSION_TTL_MS` | 24 h (absoluta) | `session-cookie.ts` |
| `SESSION_COOKIE_NAME` | `session` | `session-cookie.ts` |
| `LAST_SEEN_THROTTLE_MS` | 5 min | `session-store.ts` |
| `LOGIN_USER_LIMIT` | 5 por 60 s | `rate-limit.ts` |
| `LOGIN_IP_LIMIT` | 20 por 60 s | `rate-limit.ts` |
| `MAX_FAILED_LOGINS` | 10 | `login-policy.ts` |
| `LOCKOUT_MINUTES` | 15 | `login-policy.ts` |
| `BCRYPT_COST` | 12 (alta, rotación, seed y re-hash) | `login-policy.ts` |

## 5. Autorización

### 5.1 Guards

![Figura 2. Recorrido de autorización de una petición y sus salidas de denegación.](../img/autorizacion.png)

| Guard (`src/lib/auth-guard.ts`) | Uso | Si falla |
|---|---|---|
| `getAuthContext()` | Resolver sesión sin redirigir (API). | Devuelve `null`. |
| `requireSession()` | Toda página y acción. | `redirect('/login')`, o `/api/auth/expired` si había cookie. |
| `requirePermission(code)` | Server actions de negocio. Equivale a `requireSession()` + `assertPermission()`. | Audita `ACCESO_DENEGADO` y lanza `ForbiddenError` (`… (code) (403)`). |
| `assertPermission(ctx, code)` | Cuando el permiso depende de un dato que se lee después de autenticar (p. ej. el tipo real de una pieza). | Igual que `requirePermission`. |
| `requireAdmin()` | Toda acción de administración y catálogos. | Audita y lanza `ForbiddenError('Operación reservada al administrador (403)')`. |
| `requirePagePermission(code)` | Páginas de módulo. | Audita (`via: pagina`) y devuelve `ok: false`; la página renderiza `<AccessDenied/>`. |
| `requireAdminPage()` | **Cada** página `/admin/*` y el layout `/admin`. | Igual, con permiso `rol ADMIN`. |
| `can(ctx, code)` | Mostrar u ocultar controles en la UI. | Devuelve `false`. |
| `handleActionError(e, msg)` | `catch` de toda server action. | Re-lanza errores internos de Next (`NEXT_*`), convierte `ForbiddenError` en `{ error }` y registra el resto **sin stack**. |

### 5.2 Resolución de permisos

`hasPermission(userId, role, code)` (`src/lib/permissions.ts`):

1. Si el código no existe en `Permiso`, **deniega**.
2. Si hay fila en `UsuarioPermiso`, gana su `concedido` (override por usuario).
3. Si no, usa `RolPermiso.concedido` del rol; sin fila, deniega.

`getUserPermissions()` calcula el conjunto efectivo para el menú. El menú lateral muestra **todos** los módulos al ADMIN sin consultar la matriz; las páginas y acciones sí la consultan.

> **Importante.** Los seis permisos `admin.*` existen en el catálogo y en la matriz, pero **ningún guard los consulta**: la administración se controla solo por el rol `ADMIN` (`requireAdmin` / `requireAdminPage`).

### 5.3 Catálogo de permisos y defaults por rol

Fuente única: `src/lib/permissions-catalog.ts` (la usan la app, el seed y `sync-permissions`).

| Código | ADMIN | MENSAJERO | AGENCIA | Lo exige |
|---|---|---|---|---|
| `correspondencia.entrante.ver` | ✓ | ✓ | ✓ | Página entrante |
| `correspondencia.entrante.crear` | ✓ | — | ✓ | `registerIncomingMail`, `updateMailAction` (entrante) |
| `correspondencia.saliente.ver` | ✓ | ✓ | ✓ | Página saliente |
| `correspondencia.saliente.crear` | ✓ | — | ✓ | `registerOutgoingMail`, `updateMailAction` (saliente) |
| `correspondencia.recibir` | ✓ | — | ✓ | Página Mis Planillas, aprobar, devolver, `processPlanillaAction` |
| `planillas.ver` | ✓ | ✓ | ✓ | Páginas de planillas |
| `planillas.crear` | ✓ | ✓ | — | `generatePlanillaAction` |
| `planillas.gestionar` | ✓ | ✓ | — | Cerrar, reabrir, retirar ítem, subir firma |
| `recorridos.ver` | ✓ | ✓ | — | Página recorridos |
| `recorridos.gestionar` | ✓ | ✓ | — | Crear/agregar y anular recorridos |
| `reportes.ver` | ✓ | — | ✓ | Página reportes |
| `admin.usuarios.ver`, `admin.usuarios.gestionar`, `admin.config.ver`, `admin.config.gestionar`, `admin.permisos.ver`, `admin.permisos.gestionar` | ✓ | — | — | Ningún guard (ver la nota de 5.2) |

Para añadir un permiso: agréguelo a `PERMISOS` y `PERMISOS_CATALOGO`, asígnelo en `ROL_PERMISOS_DEFAULT`, úselo con `requirePermission` / `requirePagePermission`, declare el guard en `tests/security/actions-guarded.test.ts` y ejecute `npx tsx prisma/sync-permissions.ts` en cada base existente. Sin ese paso, `hasPermission` lo deniega a todos.

### 5.4 Tenencia por agencia

`src/lib/tenancy.ts` es el **único lugar** que decide el alcance (C-002). Ninguna página ni acción arma filtros de agencia por su cuenta.

| Rol | `scopeFor()` | `correspondenciaWhere` | `planillaWhere` |
|---|---|---|---|
| `ADMIN`, `MENSAJERO` | `GLOBAL` | `{}` | `{}` |
| `AGENCIA` con agencia | `AGENCIA` | `{ agenciaId }` | `agenciaId` propio **o** alguna pieza propia (salientes compartidas) |
| `AGENCIA` sin agencia | `NONE` | ningún registro | ningún registro |

Verificación de pertenencia en mutaciones:

- `assertAgenciaAccess(ctx, agenciaId, entidad, id)`: si falla, audita `ACCESO_DENEGADO` y lanza *El registro pertenece a otra agencia (403)*. Con `agenciaId = null` solo pasa el alcance global (así se exige alcance global para generar planillas salientes).
- `assertPlanillaAccess(ctx, planilla)` (**lectura** y procesar): entrantes por `agenciaId`; salientes si contienen piezas de la agencia. Si falla: *La planilla pertenece a otra agencia (403)*.
- `assertPlanillaManage(ctx, planilla)` (**gestión**: cerrar, reabrir, subir firma; R-031, AC-019): una planilla saliente (`agenciaId = null`) solo la gestiona el alcance global, aunque una AGENCIA tenga `planillas.gestionar` y piezas dentro (*Las planillas salientes solo las gestiona el alcance global (403)*). Para entrantes delega en `assertPlanillaAccess`.

### 5.5 Mapa de server actions

El test `tests/security/actions-guarded.test.ts` **falla** si una acción exportada no aparece aquí o usa otro guard.

| Archivo | Acción | Guard | Tenencia y reglas |
|---|---|---|---|
| `correspondencia.ts` | `registerIncomingMail` | `requirePermission(entrante.crear)` | `assertAgenciaAccess` de la agencia destino; Zod `incomingMailSchema`. |
| | `registerOutgoingMail` | `requirePermission(saliente.crear)` | Igual; subida de guía validada. |
| | `updateMailAction` | `requireSession()` **antes** de consultar la base (R-033) y luego `assertPermission()` según el **tipo real** del registro | Pertenencia; solo piezas `POR_ENTREGAR` y sin planilla (R-034); solo alcance global reasigna agencia; Zod `updateMailSchema`; `detalle.antes` en la bitácora. |
| `planillas.ts` | `generatePlanillaAction` | `requirePermission(planillas.crear)` | Saliente: alcance global. Entrante: pertenencia de la agencia. `$transaction` + `updateMany` filtrado por estado (AC-015). |
| | `closePlanillaAction`, `reopenPlanillaAction`, `uploadPlanillaFirmaAction` | `requirePermission(planillas.gestionar)` | `assertPlanillaManage` (salientes solo alcance global); cerrar y reabrir son transiciones atómicas `updateMany` condicionadas al estado (R-046). |
| | `removeCorrespondenciaFromPlanillaAction` | `requirePermission(planillas.gestionar)` | `assertAgenciaAccess` de la **pieza**; solo planillas `GENERADA`. |
| | `processPlanillaAction` | `requirePermission(correspondencia.recibir)` | `assertPlanillaAccess`; solo entrantes `CERRADA`; transición atómica; termina el recorrido si todas quedan procesadas. |
| `recorridos.ts` | `createRecorridoAction`, `anularRecorridoAction` | `requirePermission(recorridos.gestionar)` | Zod de tipo y notas (≤ 500). Crear un recorrido nuevo va en `$transaction`; el índice único parcial impide dos `INICIADO` (R-041). |
| | `aprobarCorrespondenciaAction`, `devolverCorrespondenciaAction` (y sus alias `confirmDeliveryAction`, `returnCorrespondenceAction`) | `requirePermission(correspondencia.recibir)` vía `loadPiezaParaRecepcion` | Pertenencia, estado `POR_ENTREGAR`, planilla `CERRADA` en recorrido `INICIADO`. Actualización atómica `updateMany` condicionada al estado: un doble clic no aprueba dos veces (R-041, AC-022). |
| | `checkPlanillasAbiertas` | `requirePermission(recorridos.ver)` | Conteos dentro de `planillaWhere` (R-035). |
| `admin.ts` | `saveEmpresaConfigAction`, `createUserAction`, `updateUserAction`, `deleteUserAction`, `savePermissionMatrixAction` | `requireAdmin` | Zod `empresaConfigSchema`, `createUserSchema`, `updateUserSchema`; revocación de sesiones. |
| `catalogos.ts` | 15 acciones de ciudades, empresas, agencias, centros de costo y sedes | `requireAdmin` | Validación de longitud y unicidad; bloqueo de borrado si hay dependencias. |
| `auth.ts` | `loginAction`, `logoutAction` | — (públicas por diseño) | Rate limit, bloqueo, tiempo constante. |

### 5.6 Páginas y permiso exigido

| Ruta | Guard | Comportamiento sin permiso o ajeno |
|---|---|---|
| `/` | `requireSession` | — (datos filtrados por tenencia) |
| `/correspondencia/entrante` | `requirePagePermission(entrante.ver)` | `<AccessDenied/>` |
| `/correspondencia/saliente` | `requirePagePermission(saliente.ver)` | `<AccessDenied/>` |
| `/mi-correspondencia` | `requirePagePermission(correspondencia.recibir)` | `<AccessDenied/>`; sin agencia, aviso |
| `/planillas` | `requirePagePermission(planillas.ver)` | `<AccessDenied/>` |
| `/planillas/[id]` | `requirePagePermission(planillas.ver)` + `planillaWhere` | Ajena: audita y responde **404** (sin enumeración) |
| `/recorridos` | `requirePagePermission(recorridos.ver)` | `<AccessDenied/>` |
| `/reportes` | `requirePagePermission(reportes.ver)` | `<AccessDenied/>`; `agenciaId` ajeno en la URL se ignora |
| `/admin/**` | `requireAdminPage` en **cada** `page.tsx` y en el layout | `<AccessDenied permiso="rol ADMIN"/>` |

`tests/security/page-guards.test.ts` recorre todo `page.tsx` bajo `(dashboard)` y falla si alguno no llama su guard (`requireSession`, `requirePagePermission` o `requireAdminPage`) antes de usar Prisma, o si una página de `/admin` no usa `requireAdminPage`. La pantalla *Acceso denegado* responde con estado HTTP 200 (R-042, aceptado como semántica de UI).

## 6. Archivos

### 6.1 Validación de subida

`saveUploadedFile(file, prefix)` (`src/lib/uploads.ts`, C-006):

1. `validateUploadFile`: tamaño ≤ 10 MB (`MAX_UPLOAD_BYTES`), MIME en la whitelist y extensión coherente con el MIME (tabla siguiente).
2. Lee el contenido y vuelve a comprobar el tamaño.
3. `validateUploadContent`: los primeros bytes deben coincidir con la extensión. Un *polyglot* con MIME de imagen y contenido HTML se rechaza.
4. Genera el nombre en el servidor: `<prefijo><timestamp>-<uuid><ext>`. El nombre original del cliente no se usa.
5. Escribe con `flag: "wx"` (falla si existiera) y devuelve la URL `/api/uploads?filename=<nombre>`.

| MIME | Extensiones | Firma (*magic bytes*) |
|---|---|---|
| `application/pdf` | `.pdf` | `%PDF-` |
| `image/png` | `.png` | `89 50 4E 47 0D 0A 1A 0A` |
| `image/jpeg` | `.jpg`, `.jpeg` | `FF D8 FF` |

SVG está excluido (XSS almacenado). `next.config.ts` fija `serverActions.bodySizeLimit = "11mb"` para que el límite de la app (10 MB) sea el efectivo.

### 6.2 Directorio de almacenamiento

`resolveUploadsDir()` decide el directorio con esta prioridad:

1. `UPLOADS_DIR` (entorno).
2. `EmpresaConfig.uploadsDir` (no tiene pantalla; solo por base de datos).
3. `<raíz>/storage/uploads`.

Si el resultado cae dentro de `public/`, se **rechaza** con una advertencia en consola y se usa el valor por defecto. `storage/` y `public/uploads/` están en `.gitignore`.

### 6.3 Entrega por `/api/uploads`

`GET /api/uploads?filename=<nombre>` (`src/app/api/uploads/route.ts`):

| Condición | Respuesta |
|---|---|
| Sin sesión viva (`getAuthContext()` nulo) | `401 Unauthorized` |
| Falta `filename` | `400` |
| Nombre con ruta o caracteres fuera de `[A-Za-z0-9._-]` | `400 Bad Request` |
| Ningún objeto referencia el archivo | `404` |
| Referenciado, pero fuera del alcance del usuario | `403` y auditoría `ARCHIVO_DENEGADO` |
| Archivo ausente en disco | `404` |
| Permitido | `200` con el contenido |

Cabeceras de la respuesta: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'self'`, `Cache-Control: private, no-store`, `X-Frame-Options: SAMEORIGIN`. PDF, PNG y JPG se sirven `inline`; cualquier otra extensión, como `application/octet-stream` con `attachment`.

La lectura busca primero en el directorio privado y después, solo lectura, en el legado `public/uploads` (archivos aún no migrados). El middleware matcher excluye `/api`, por eso la ruta se protege explícitamente.

### 6.4 ACL por objeto

`resolveUploadAccess(ctx, filename)` (`src/lib/upload-access.ts`) busca qué objeto referencia el archivo:

| Referencia | Quién accede |
|---|---|
| `EmpresaConfig.logoUrl` | Cualquier sesión válida. |
| `Correspondencia.guiaUrl` o `documentoRecibidoUrl` | Tenencia de la agencia de la pieza. |
| `Planilla.documentoFirmaUrl` | Entrante: tenencia por `agenciaId`. **Saliente: solo alcance global** (R-030, AC-018): la hoja firmada reúne piezas de todas las agencias. La página tampoco muestra `FirmaPreview` ni `UploadFirmaForm` a una AGENCIA en salientes. |
| Ninguna | `NOT_FOUND`: no se sirven huérfanos. |

### 6.5 Directorio legado `/uploads`

El middleware responde `404` a cualquier ruta `/uploads/*`, aunque `public/uploads` conserve archivos. `prisma/migrate-uploads.ts` mueve esos archivos al directorio privado y reescribe `/uploads/<x>` → `/api/uploads?filename=<x>` en `guiaUrl`, `documentoRecibidoUrl`, `documentoFirmaUrl` y `logoUrl`. Es idempotente y admite `--dry-run`.

## 7. Cabeceras, CSP y redirecciones

### 7.1 Cabeceras estáticas

`next.config.ts` aplica a todas las rutas (`/(.*)`):

| Cabecera | Valor |
|---|---|
| `X-DNS-Prefetch-Control` | `on` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

La CSP **no** se define en `next.config.ts`: si estuviera en los dos sitios, el navegador aplicaría la intersección.

### 7.2 CSP con nonce

El middleware genera un nonce de 16 bytes por petición (`generateNonce`), construye la política con `buildCsp()` (`src/lib/csp.ts`) y la pone en la respuesta y en la petición (cabeceras `x-nonce` y `content-security-policy`, que Next.js usa para marcar sus scripts).

| Directiva | Valor |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'nonce-…' 'strict-dynamic'` (+ `'unsafe-eval'` solo en desarrollo) |
| `style-src` | `'self' 'unsafe-inline'` (riesgo residual R-022) |
| `img-src` | `'self' data: blob:` |
| `font-src` | `'self' data:` |
| `connect-src`, `base-uri`, `form-action`, `frame-ancestors`, `frame-src` | `'self'` |
| `object-src` | `'none'` |
| `upgrade-insecure-requests` | Solo en producción |

### 7.3 Colores de marca

Los colores de `EmpresaConfig` se inyectan en un `<style>` global (`ThemeInjector`). Para impedir XSS almacenado (AC-013):

- `empresaConfigSchema` exige el formato HSL de Tailwind con `HSL_REGEX` (`src/lib/branding.ts`).
- `ThemeInjector` **re-valida** con `sanitizeHsl()` y descarta en silencio lo que no cumpla, aunque venga directo de la base.
- `logoUrl` solo admite rutas relativas de la app o `https://` (`isSafeLogoUrl`); nunca `javascript:` ni `data:`. Una ruta relativa debe empezar por `/` seguido de algo que no sea `/` ni `\` (R-042: algunos navegadores normalizan `/\host` como `//host`).

### 7.4 Redirecciones seguras

`resolveOrigin()` (`src/lib/request-origin.ts`, C-009) construye el origen de toda redirección del middleware y de `/api/auth/expired`:

- Con `ALLOWED_HOSTS` definido, la cabecera `Host` solo se respeta si está en la lista; si no, se usa el **primer** host permitido.
- Sin `ALLOWED_HOSTS` (desarrollo), se usa el host que resolvió Next.js, nunca la cabecera cruda.
- El protocolo solo puede ser `http` o `https`.

### 7.5 Exportación CSV segura

La exportación de **Reportes** se genera en el navegador (`ReportView.tsx`). Cada celda pasa por `csvCell()` (`src/lib/csv.ts`, R-037, AC-021): si empieza por `=`, `+`, `-`, `@`, tabulador o retorno de carro, se antepone un apóstrofo para que Excel o LibreOffice no la ejecuten como fórmula; además escapa comillas y envuelve la celda entre comillas.

## 8. Rate limit y bloqueo de cuenta

- `checkRateLimit` es una ventana fija con un **store intercambiable** (`RateLimitStore`). Por defecto vive en memoria del proceso y limpia entradas vencidas al superar 10 000 claves.
- Si la app escala a varios procesos, implemente `RateLimitStore` sobre un almacén compartido y regístrelo con `setRateLimitStore()` al arrancar (R-020). Hoy no hay ninguno registrado.
- El **bloqueo persistente** (10 fallos → 15 min) vive en `Usuario.lockedUntil`: sobrevive a reinicios y a varias instancias. Un administrador desbloquea al fijar una contraseña nueva; `rotate-passwords.ts` también reinicia el bloqueo.
- La IP se toma del **último** valor de `X-Forwarded-For` (el que añade el proxy de confianza), luego de `X-Real-IP`; se quita el prefijo `::ffff:` y se limita a 64 caracteres.

## 9. Notificaciones

`src/lib/notifications.ts` es el único punto de salida de correo. Se usa en dos casos: al iniciar un recorrido (aviso a usuarios y correo de cada agencia) y al completar una saliente con guía, empresa, mensajero y soporte (aviso al correo de la agencia).

> **Planificado (R-021).** El envío real **no está activo**: ningún código llama `setMailProvider()`. Sin proveedor, `sendMail()` devuelve `{ sent: false }` y registra solo el número de destinatarios y el asunto (en producción, ni siquiera el asunto). Para activarlo, registre un proveedor SMTP al arrancar con las credenciales del cliente.

## 10. Integraciones

| Integración | Estado | Notas |
|---|---|---|
| PostgreSQL | Activa | Vía Prisma; `DATABASE_URL`. |
| Proxy inverso (Caddy o Nginx) | Activa | Termina TLS; debe fijar `X-Forwarded-For` y `X-Forwarded-Proto`. |
| Correo SMTP | Planificado | R-021; ver sección 9. |
| Almacén compartido para rate limit | Planificado | R-020; ver sección 8. |

SISMAR no expone API pública para terceros. Las únicas rutas HTTP propias son `/api/uploads` y `/api/auth/expired`; el resto son páginas y server actions.

## 11. Seguridad

### 11.1 Threat model resumido

Fronteras de confianza: Internet → proxy (TLS) → Node (loopback) → PostgreSQL (loopback). El navegador es hostil y las server actions son endpoints públicos que solo exigen una cookie válida.

| Abuse case | Abuso | Control | Contrato |
|---|---|---|---|
| AC-001 | AGENCIA ve datos de todas las agencias. | Tenencia obligatoria en toda consulta. | C-002, C-007 |
| AC-002 | AGENCIA edita una pieza ajena con `tipo` manipulado. | Cargar registro, tipo real, pertenencia → 403. | C-003 |
| AC-003 | MENSAJERO aprueba sin que la agencia reciba. | Permiso `correspondencia.recibir` + pertenencia. | C-003 |
| AC-004 | AGENCIA cierra o reabre planillas ajenas. | `planillas.gestionar` + pertenencia. | C-004 |
| AC-005 | AGENCIA invoca una acción de catálogo. | `requireAdmin()` en toda acción de catálogo. | C-005 |
| AC-006 | Admin degradado o usuario borrado sigue operando. | Rol y agencia de BD por petición; revocación. | C-001 |
| AC-007 | Cookie robada tras el logout de la víctima. | Logout revoca la sesión en servidor. | C-001 |
| AC-008 | Enlace directo `/uploads/<archivo>`. | Archivos fuera de `public/`; middleware 404. | C-006 |
| AC-009 | Adivinar nombres en `/api/uploads`. | ACL por objeto; 403/404. | C-006 |
| AC-010 | Polyglot `image/jpeg` con HTML/JS. | Magic bytes, `nosniff`, `Content-Disposition`, CSP `default-src 'none'`. | C-006 |
| AC-011 | Enumeración por tiempo; credential stuffing. | Hash de relleno, límite por IP, bloqueo persistente. | C-008 |
| AC-012 | `Host` hostil → redirección a otro dominio. | Allowlist `ALLOWED_HOSTS`. | C-009 |
| AC-013 | Color de marca con `}</style><script>`. | HSL validado en Zod y en el inyector; CSP con nonce. | C-010 |
| AC-014 | Seed en producción borra todo y deja contraseña conocida. | Seed no destructivo, sin credenciales fijas, bloqueado en producción. | C-012 |
| AC-015 | Dos clics concurrentes duplican ítems en planillas. | Transacción + `updateMany` filtrado por estado. | C-013 |
| AC-016 | AGENCIA o cookie revocada pide una página `/admin` por RSC declarando los layouts ya renderizados. | Guard propio en cada `page.tsx`; test `page-guards`; PoC RSC. | C-005, C-007 |
| AC-017 | Explotación de avisos publicados de Next.js. | `next` 16.3.8 exacto, `overrides`, `npm audit --omit=dev` antes de desplegar. | transversal |
| AC-018 | AGENCIA descarga la firma de una planilla saliente compartida. | ACL de firma saliente solo alcance global. | C-002, C-006 |
| AC-019 | AGENCIA con `planillas.gestionar` delegado gestiona una saliente compartida. | `assertPlanillaManage`. | C-004 |
| AC-020 | Enumeración por tiempo con hashes heredados de coste 10. | `needsRehash` y re-hash a coste 12; rotación de cuentas heredadas. | C-008 |
| AC-021 | Fórmula en un asunto se ejecuta al abrir el CSV. | `csvCell`. | C-003 |
| AC-022 | Doble aprobación o dos recorridos `INICIADO`. | `updateMany` condicionado; transacción; índice único parcial. | C-013 |

### 11.2 Riesgos residuales (RADAR)

| Código | Color | Riesgo | Mitigación |
|---|---|---|---|
Riesgos abiertos o aceptados según `artefacts/H-003/RADAR.md` al 2026-10-01:

| Código | Color | Riesgo | Mitigación / estado |
|---|---|---|---|
| R-020 | AMARILLO | Contador de rate limit en memoria por proceso. | Bloqueo persistente en BD; almacén compartido si se escala. Abierto. |
| R-021 | AMARILLO | Envío real de correo pendiente de SMTP del cliente. | Módulo listo; sin datos personales en logs. Abierto. |
| R-022 | AZUL | `style-src 'unsafe-inline'`. | Requisito de Next/Radix e impresión; colores validados. Aceptado. |
| R-023 | NARANJA | Archivos legados en `public/uploads` del servidor. | Ejecutar `migrate-uploads.ts` en el despliegue; el middleware ya bloquea `/uploads/*`. Abierto hasta el despliegue. |
| R-024 | AMARILLO | Cobertura medida solo en `src/lib`. | Páginas validadas por build, E2E y test estático de guards. Abierto. |
| R-025 | AMARILLO | Subida de archivos desde la UI sin E2E automatizado. | Verificar en pre-producción. Abierto. |
| R-026 | AMARILLO | Al desplegar, las sesiones previas quedan inválidas. | Comunicar a los usuarios. Abierto hasta el despliegue. |
| R-029 | ROJO→parcial | Archivos de usuarios (PDF) versionados en el historial de git desde el commit inicial. | Ya no se versionan; la purga del historial en los remotos requiere **decisión humana** (Ley 1581). |
| R-032 | AZUL | Cuentas con hash heredado de coste 10 que no vuelven a iniciar sesión. | Verificar en el servidor (sección 15.3) y rotar las que aparezcan. |
| R-038 | AMARILLO | El bloqueo de cuenta permite bloquear a propósito un usuario conocido (por ejemplo, `admin`). | Límite por IP, renombrar `admin` al desplegar, alertar ante `LOGIN_BLOQUEADO`. Monitoreado. |
| R-042 | INFO | Puntos menores aceptados: `/api/auth/expired` por GET sin CSRF (solo borra la cookie local); CSP solo en el middleware; AuditLog append-only por convención; mensajes de Prisma en logs; *Acceso denegado* con HTTP 200. | Documentados. |
| R-047 | AZUL | Un remoto espejo conserva en su historial archivos y un runbook con datos de infraestructura. | Incluir en la decisión de R-029. |

### 11.3 Reglas que no se negocian al cambiar código

1. Toda server action nueva empieza con un guard (`requirePermission`, `requireAdmin` o, si la Spec lo permite, `requireSession`) y se declara en `actions-guarded.test.ts`.
2. Toda página nueva bajo `(dashboard)` llama su propio guard antes de consultar datos; las de `/admin`, `requireAdminPage()`. El layout no protege (AC-016).
3. Toda consulta de datos de negocio pasa por `correspondenciaWhere`, `planillaWhere` o `agenciaWhere`; toda mutación por `id` verifica pertenencia.
4. Toda entrada de usuario se valida con Zod (`safeParse`) dentro de la acción, no solo en el formulario.
5. Toda subida pasa por `saveUploadedFile`; todo archivo se sirve solo por `/api/uploads`.
6. Toda operación de negocio o de administración llama `audit()`.
7. Los `catch` usan `handleActionError`: nunca un catch vacío, nunca un stack en el log.

## 12. Pruebas

### 12.1 Ejecutar la suite

```bash
npm test            # equivale a: vitest run
```

- Configuración: `vitest.config.ts` (entorno `node`, alias `@` → `src`, `include: tests/**/*.test.ts`).
- `tests/setup.ts` define un `JWT_SECRET` de prueba antes de importar `@/lib/auth`.
- La suite **no necesita base de datos**: los tests de comportamiento simulan Prisma y la sesión con `vi.mock`. Los de archivos usan un directorio temporal del sistema operativo.
- Evidencia de esta versión: ejecución del 2026-10-01 tras la revisión Guardian → **30 archivos, 252 tests en verde**.
- Cobertura (proveedor v8, `@vitest/coverage-v8` en `devDependencies`; no hay script ni umbral en `vitest.config.ts`):

```bash
npx vitest run --coverage --coverage.include='src/lib/**'
```

- Medición del 2026-10-01 sobre `src/lib`: **81,43 % sentencias · 81,42 % ramas · 86,31 % funciones · 82,71 % líneas**. Páginas y componentes no se miden (R-024). El reporte se escribe en `coverage/`, excluido de git.

### 12.2 Inventario

| Archivo (`tests/security/`) | Qué verifica | Escenarios / Contratos |
|---|---|---|
| `actions-guarded.test.ts` | Guard esperado por cada acción exportada (ignora comentarios, R-036); falla ante acciones no declaradas. | S-024 · C-014 |
| `page-guards.test.ts` | Todo `page.tsx` bajo `(dashboard)` llama su guard antes de Prisma; las de `/admin`, `requireAdminPage`. | S-015, S-027 · C-005, C-007 |
| `login-action.test.ts` | Comportamiento de `loginAction` con Prisma y bcrypt simulados: mensaje genérico, re-hash de hashes heredados, usuario anonimizado. | S-016, S-029 · C-008 |
| `admin-actions.test.ts` | `updateUserAction` revoca sesiones al cambiar rol o contraseña. | S-001 · C-001, C-015 |
| `csv-export.test.ts` | Neutralización de fórmulas en CSV. | AC-021 |
| `authz-actions.test.ts` | IDOR en `updateMailAction` (guard antes de la BD, solo piezas pendientes, `detalle.antes`), aprobar/devolver atómico, ciclo de planillas, catálogos solo ADMIN. | S-006…S-011, S-030 · C-003, C-004, C-005, C-013 |
| `auth-guard.test.ts` | `requireSession` (sin cookie, JWT corrupto, sesión no viva, contexto fresco), `requireAdmin` y `handleActionError`. | S-001…S-003 · C-001, C-005 |
| `session-store.test.ts` | `resolveSession`, revocación, contexto fresco. | S-001…S-003 · C-001 |
| `middleware.test.ts` | Redirecciones, limpieza de cookie, `/uploads` 404, salida sin bucle, `/login` exacto. | C-001, C-006, C-009 |
| `cookie-attrs.test.ts` | Atributos de cookie en set, clear y middleware. | C-001 (B-01) |
| `tenancy.test.ts` | `scopeFor`, filtros Prisma, `assert*`, `assertPlanillaManage`. | S-004, S-005, S-028 · C-002, C-004 |
| `upload-access.test.ts`, `uploads-route.test.ts`, `uploads-validation.test.ts` | ACL por objeto (firma saliente solo global), códigos de `/api/uploads`, whitelist, magic bytes, directorio privado. | S-012…S-014, S-028 · C-006 |
| `login-hardening.test.ts`, `rate-limit.test.ts` | Límites por usuario e IP, IP de `X-Forwarded-For`, bloqueo, hash de relleno, `needsRehash`. | S-016, S-017, S-029 · C-008 |
| `request-origin.test.ts` | Allowlist de hosts y protocolo. | S-018 · C-009 |
| `csp-branding.test.ts`, `headers.test.ts` | CSP con nonce, HSL y logo, `ThemeInjector`, cabeceras estáticas. | S-019, S-020 · C-010 |
| `audit.test.ts` | `audit()` escribe y nunca interrumpe. | S-021 · C-011 |
| `seed-safety.test.ts`, `no-hardcoded-credentials.test.ts` | Seed no destructivo y que aborta con variables inválidas (R-039); sin credenciales en `src/`, `prisma/`, `docs/` ni `deploy/`. | S-022 · C-012 |
| `schemas-h003.test.ts`, `zod-integration.test.ts` | Esquemas de usuario, alta (topes R-040) y edición; acciones usan `safeParse`. | S-025 · C-003, C-015 |
| `permission-enforcement.test.ts` | Precedencia rol/override en `hasPermission` y en el menú; `updateMailAction` exige permiso de creación. | H-002 (inferido) |
| `package-deps.test.ts` | Dependencias de runtime y saneamiento de nombres. | S-026 · C-016 |
| `password-policy.test.ts`, `password-generate.test.ts`, `consecutive.test.ts` | Política de contraseñas, generador fuerte, consecutivos sin colisión. | H-001 (SEC-019, SEC-020) |
| `tests/parametrizacion.test.ts` | Código correlativo de centros de costo y esquemas de centro de costo y sede. | H-002 (inferido) |

### 12.3 Lo que la suite no cubre

- Los archivos `.feature` (STR-A10) **no se ejecutan con un runner Gherkin**: el repositorio no tiene Cucumber ni equivalente. Los escenarios se verifican con los tests de Vitest que llevan su código `S-NNN` y con el smoke E2E manual registrado en la respuesta a la auditoría.
- No hay pruebas E2E automatizadas que corran con `npm test` ni pruebas contra una base PostgreSQL real. `tests/e2e/rsc-admin-bypass.poc.ts` es una prueba **manual** de R-028 contra un servidor local: requiere `npm run build && npm start`, el `.env` de una base local con los usuarios del seed, y crea filas en `Sesion` con `ip = 'poc'`. Uso: `set -a && . ./.env && set +a && npx tsx tests/e2e/rsc-admin-bypass.poc.ts`.
- S-023 (la base rechaza valores fuera del dominio) se verifica con la propia migración, no con un test.
- S-015 tiene un test **estático** (`page-guards`), no de comportamiento: no hay test unitario que renderice `requirePagePermission` o `requireAdminPage`. El comportamiento (404 en planilla ajena, *Acceso denegado* en `/admin`) se verificó con el smoke E2E registrado en el acta de cierre.

## 13. Configuración y variables de entorno

| Variable | Obligatoria | Uso en el código |
|---|---|---|
| `DATABASE_URL` | Sí | Prisma (`prisma/schema.prisma`). |
| `JWT_SECRET` | Sí | Firma y verificación del JWT (`src/lib/auth.ts`, `src/middleware.ts`). Si falta, la app lanza al importar el módulo. El código no impone longitud: use al menos 64 bytes aleatorios (`openssl rand -hex 64`). Rotarlo invalida todos los tokens y cambia los identificadores anonimizados de la bitácora (sección 3.4). |
| `ALLOWED_HOSTS` | Sí en producción | Allowlist de hosts para redirecciones, separada por comas. |
| `UPLOADS_DIR` | Recomendada | Directorio privado de archivos. |
| `NODE_ENV` | Sí | `production` activa `secure` en la cookie, quita `'unsafe-eval'` y añade `upgrade-insecure-requests` a la CSP, oculta asuntos en logs de notificación y bloquea el seed. |
| `SEED_ADMIN_PASSWORD`, `SEED_MENSAJERO_PASSWORD`, `SEED_GERENCIA_PASSWORD`, `SEED_TALENTO_PASSWORD` | No | Contraseñas iniciales del seed en una base vacía (≥ 8 caracteres). |
| `SEED_ALLOW_PRODUCTION` | No | `1` permite correr el seed con `NODE_ENV=production`. |

Ejemplo ficticio (valores de muestra, no utilizables):

```bash
DATABASE_URL="postgresql://usuario_ejemplo:clave_ejemplo@localhost:5432/sismar?schema=public"
JWT_SECRET="<pegue aquí la salida de: openssl rand -hex 64>"
ALLOWED_HOSTS="sismar.ejemplo.test"
UPLOADS_DIR="/ruta/ejemplo/sismar/storage/uploads"
NODE_ENV=production
```

## 14. Desarrollo local

```bash
npm install
cp .env.example .env            # edite DATABASE_URL y JWT_SECRET
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts          # no destructivo; muestra una vez las contraseñas generadas
npm run dev
npm test
npm run lint                    # eslint con eslint-config-next
```

`iniciar.bat` (Windows) libera el puerto de desarrollo, borra `.next`, instala dependencias si faltan y ejecuta `npm run dev`.

## 15. Operación y diagnóstico

### 15.1 Scripts operativos

| Comando | Para qué | Notas |
|---|---|---|
| `npx prisma migrate deploy` | Aplicar migraciones pendientes. | Ver sección 3.7. |
| `npx tsx prisma/seed.ts` | Catálogos, permisos y, si la tabla está vacía, usuarios iniciales. | No destructivo. Aborta con código 2 si `NODE_ENV=production` (salvo `SEED_ALLOW_PRODUCTION=1`) y con código 3, sin crear usuarios, si una `SEED_*_PASSWORD` no cumple la política (R-039). |
| `npx tsx prisma/sync-permissions.ts` | Crear permisos nuevos y defaults de rol que falten. | Idempotente; no sobrescribe decisiones de la matriz; nunca borra. |
| `npx tsx prisma/migrate-uploads.ts [--dry-run]` | Mover archivos legados y reescribir URLs. | Idempotente. |
| `npx tsx prisma/rotate-passwords.ts [usuarios…]` | Rotar contraseñas (por defecto los cuatro usuarios del seed), reiniciar bloqueo y revocar sesiones. | Imprime las nuevas contraseñas una sola vez; solo actualiza usuarios existentes. |
| `npm audit --omit=dev` | Revisar avisos de dependencias de runtime antes de desplegar. | Debe reportar 0 altas o críticas (`docs/OPERACION.md` §4 y §9). |
| `npx tsx prisma/backfill_tipo.ts` | Script legado: marca como `SALIENTE` registros antiguos con `empresaMensajeria = 'SALIENTE'`. | Solo para datos anteriores al campo `tipo`. |

### 15.2 Registros (logs)

- Las acciones registran solo `error.message`, nunca el stack (`handleActionError`).
- `[audit] no se pudo registrar la bitácora: …` indica que falló la escritura de `AuditLog`; la operación de negocio siguió.
- `[uploads] el directorio configurado está dentro de public/ …` indica una configuración de `UPLOADS_DIR` rechazada.
- `[notificaciones] proveedor de correo no configurado; N aviso(s) omitido(s)` es el comportamiento esperado mientras R-021 siga abierto.

### 15.3 Consultas útiles

Accesos denegados y bloqueos recientes:

```sql
SELECT fecha, username, accion, entidad, "entidadId", ip
FROM "AuditLog"
WHERE accion IN ('ACCESO_DENEGADO','ARCHIVO_DENEGADO','LOGIN_BLOQUEADO','LOGIN_LIMITADO')
ORDER BY fecha DESC LIMIT 100;
```

Sesiones activas de un usuario (nombre ficticio):

```sql
SELECT s.id, s."createdAt", s."expiresAt", s."lastSeenAt", s.ip
FROM "Sesion" s JOIN "Usuario" u ON u.id = s."usuarioId"
WHERE u.username = 'usuario.ejemplo' AND s."revokedAt" IS NULL AND s."expiresAt" > now();
```

Cuentas con hash heredado de coste 10 (R-032; deben ser 0 o rotarse):

```sql
SELECT username FROM "Usuario" WHERE password LIKE '$2_$10$%';
```

Revocar todas las sesiones (incidente):

```sql
UPDATE "Sesion" SET "revokedAt" = now() WHERE "revokedAt" IS NULL;
```

Limpieza de sesiones vencidas o revocadas hace más de 7 días (equivale a `purgeSessions(7)`):

```sql
DELETE FROM "Sesion"
WHERE "expiresAt" < now() - interval '7 days' OR "revokedAt" < now() - interval '7 days';
```

### 15.4 Diagnóstico de síntomas frecuentes

| Síntoma | Causa probable | Revisión |
|---|---|---|
| Bucle de redirecciones o regreso constante al login | Cookie con sesión revocada y navegador que no la borra; o `ALLOWED_HOSTS` mal definido. | Verificar que `/api/auth/expired` responda `303` y limpie la cookie; revisar `ALLOWED_HOSTS`. |
| Redirecciones hacia `localhost` detrás del proxy | Falta `ALLOWED_HOSTS`. | Definirlo con el dominio público. |
| Todos los usuarios pierden un módulo tras actualizar | Permiso nuevo sin sincronizar (`hasPermission` deniega códigos inexistentes). | Ejecutar `sync-permissions.ts`. |
| Scripts bloqueados por CSP en la consola del navegador | Página prerenderizada o nonce no propagado. | Confirmar `force-dynamic` en el layout raíz y que el middleware corre para la ruta. |
| Archivos que devuelven 404 tras actualizar | URLs legadas `/uploads/…` o archivos aún en `public/uploads`. | Ejecutar `migrate-uploads.ts --dry-run` y luego sin la bandera. |
| Usuario reporta *Credenciales inválidas* con la clave correcta | Cuenta bloqueada. | Revisar `lockedUntil` o `LOGIN_BLOQUEADO` en `AuditLog`; fijar contraseña nueva. |
| La migración H-003 aborta | Valores fuera de dominio en columnas a convertir. | Corregir los valores listados en el mensaje y repetir. |

## 16. Trazabilidad STRATA

### 16.1 Flujos

| Flujo | Origen | Artefactos en el repositorio |
|---|---|---|
| H-001 | Remediación SAST FOSCAL, jul/2026 (SEC-001…SEC-020). | Sin Spec formal en `specs/`; respuesta en `docs/auditoria/RESPUESTA_AUDITORIA_SISMAR.md`. |
| H-002 | Ajustes post-piloto del cliente (centros de costo, sedes, permisos de agencia, anexos, firma). | Sin Spec formal en `specs/`. |
| H-003 | Auditoría de caja blanca N.º 2 (31/08/2026, 23 hallazgos). | `specs/H-003-remediacion-auditoria-2/` completo. |

### 16.2 Funcionalidad → Flujo → Contratos

| Funcionalidad | Flujo | Contratos |
|---|---|---|
| Sesión revocable, contexto fresco, `/api/auth/expired` | H-003 | C-001 |
| Tenencia por agencia en lecturas | H-003 | C-002 |
| Edición, aprobación y devolución de correspondencia | H-003 | C-003 |
| Ciclo de vida de planillas | H-003 | C-004, C-013 |
| Catálogos solo ADMIN | H-003 | C-005 |
| Archivos privados con ACL y magic bytes | H-003 | C-006 |
| Permiso explícito en páginas y *Acceso denegado* | H-003 | C-007 |
| Login endurecido y bloqueo de cuenta | H-003 | C-008 |
| Redirecciones con allowlist | H-003 | C-009 |
| CSP con nonce y colores validados | H-003 | C-010 |
| Bitácora, autoría y notificaciones | H-003 | C-011 |
| Seed no destructivo | H-003 | C-012 |
| Enums, índices y transacciones | H-003 | C-013 |
| Tests de autorización por acción | H-003 | C-014 |
| Usuarios con correo y agencia obligatoria | H-003 | C-015 |
| Saneamiento de dependencias y documentación | H-003 | C-016 |
| Registro de entrantes y salientes, planillas, recorridos, reportes y catálogos (funcionalidad base) | Sin Flujo registrado (desarrollo previo a STRATA en el repositorio) | Sin Contrato formal |
| Centros de costo y sedes; menú y matriz de permisos con overrides; anexos visibles en Mis Planillas; vista previa de firma | H-002 (asignación inferida de los commits; sin Spec) | Sin Contrato formal |
| Política de contraseñas, consecutivos sin colisión, cabeceras estáticas, whitelist de subidas, rotación de contraseñas | H-001 (SEC-001…SEC-020) | Sin Contrato formal |

### 16.3 Contratos del Flujo H-003

Estado registrado en `contracts.yaml` al 2026-10-01: **FIRMADO** en los 16 contratos (el archivo aún no los pasa a VERIFICADO ni CERRADO). La revisión Guardian añadió los escenarios S-027…S-030 en `autorizacion.feature` (AC-016, AC-018/AC-019, AC-020 y AC-022), que `contracts.yaml` todavía no enlaza.

| Contrato | Nombre | Capa | Hallazgos | Escenarios |
|---|---|---|---|---|
| C-001 | Contexto de autenticación fresco y sesión revocable | LOG, PER, GRD | A-05, B-01 | S-001…S-003 |
| C-002 | Alcance de tenencia por agencia en lecturas | LOG | A-01 | S-004, S-005 |
| C-003 | Autorización por objeto en mutaciones de correspondencia | LOG, GRD | A-02, B-06 | S-006…S-008 |
| C-004 | Permiso y dueño en el ciclo de vida de planillas | LOG, GRD | A-03 | S-009, S-010 |
| C-005 | Catálogos exclusivos de ADMIN y guard único | LOG, GRD | A-04, M-01 | S-011 |
| C-006 | Archivos privados con ACL por objeto y validación de contenido | LOG, GRD | A-06, M-03 | S-012…S-014 |
| C-007 | Páginas de negocio exigen permiso | VIS, LOG | M-01 | S-015 |
| C-008 | Login endurecido | LOG, PER, GRD | M-04, M-08 | S-016, S-017 |
| C-009 | Redirecciones solo a orígenes permitidos | LOG, GRD | M-05 | S-018 |
| C-010 | CSP con nonce y colores de marca validados | VIS, GRD | M-06 | S-019, S-020 |
| C-011 | Bitácora de auditoría y autoría | PER, LOG | M-07, B-05 | S-021 |
| C-012 | Seed no destructivo sin credenciales conocidas | PER, GRD | M-02 | S-022 |
| C-013 | Integridad del modelo (enums, índices, transacciones) | PER | B-02, B-03 | S-023 |
| C-014 | Tests de autorización reales | GRD | B-04 | S-024 |
| C-015 | Usuarios con email validado y agencia obligatoria para AGENCIA | VIS, LOG | B-05, B-09 | S-025 |
| C-016 | Saneamiento de mantenimiento y operación | LOG | B-07, B-08 | S-026 |

### 16.4 Convenciones STRATA en el repositorio

```
specs/H-NNN-<slug>/spec.md            STR-A09 · Spec del Flujo (criterios binarios)
specs/H-NNN-<slug>/threat-model.md    STR-A13 · Abuse cases AC-NNN
specs/H-NNN-<slug>/contracts.yaml     Contratos C-NNN (estado, capa, reglas, escenarios)
specs/H-NNN-<slug>/scenarios/*.feature STR-A10 · Escenarios S-NNN en Gherkin (español)
tests/security/*.test.ts              Tests TDD; el nombre del describe cita S-NNN / C-NNN
docs/manuales/                        Manuales (fuente Markdown en fuente/, .docx generado)
```

Los códigos (`H-NNN`, `C-NNN`, `S-NNN`, `AC-NNN`, `R-NNN`) son únicos y no se reciclan. Todo cambio nuevo abre o extiende un Flujo con su Spec **antes** del código.

## 17. Limitaciones conocidas

Comportamientos verificados en el código que conviene conocer al mantenerlo:

| Tema | Comportamiento actual |
|---|---|
| Edición de anexos | La lista de entrantes no carga los anexos; al **Completar**, el formulario empieza vacío y, si se agrega algún anexo, `updateMailAction` reemplaza todos los anteriores (`deleteMany` + `create`). |
| Agregar a un recorrido con planillas procesadas | Si el recorrido `INICIADO` tiene alguna planilla `PROCESADA`, `createRecorridoAction` intenta crear un recorrido nuevo; el índice único parcial lo impide y la acción responde el mensaje genérico *Error al crear el recorrido*. La UI sigue mostrando el botón *Agregar*. |
| Contador del botón *Agregar planillas* | `planillasCerradas` cuenta también las planillas ya incluidas en el recorrido en curso. |
| Historial de recorridos | La página solo muestra el recorrido `INICIADO` más reciente; no hay vista de terminados ni anulados. |
| Búsqueda en reportes | `contains` de Prisma sin `mode: 'insensitive'`: distingue mayúsculas en PostgreSQL. Máximo 100 filas. |
| Retiro de piezas en salientes | `removeCorrespondenciaFromPlanillaAction` verifica la pertenencia de la **pieza**, no `assertPlanillaManage`: una AGENCIA con `planillas.gestionar` delegado podría retirar su propia pieza de una saliente invocando la acción. La UI no le muestra el botón. |
| Menú del ADMIN | Muestra todos los módulos aunque la matriz le retire un permiso; la página correspondiente sí lo deniega. |
| Archivos reemplazados | Al subir una guía o firma nueva, el archivo anterior queda en disco sin referencia (no se sirve: `/api/uploads` responde 404). |
| Crédito de marca en la UI | La interfaz de la app no muestra el crédito *By AISerNet Company*. |
