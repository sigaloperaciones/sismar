# STR-A09 · Spec de Flujo H-003 — Remediación de la Auditoría de Seguridad y Arquitectura N.º 2

| Campo | Valor |
|---|---|
| Flujo | H-003 |
| Origen | Auditoría de caja blanca del cliente, fechada 31/08/2026 (23 hallazgos: 6 altos, 8 medios, 9 bajos). Documento: `docs/auditoria/auditoria-seguridad-arquitectura - analisis 2.pdf` |
| Fecha de la Spec | 01/10/2026 |
| Arquitecto de Specs | Claude (Fable 5.1) para AISerNet Company — Equipo ASIA |
| Estado | FIRMADA (Gate SDD) — firma humana: Mauricio Tarazona al aprobar el Pulso |
| Flujos previos (sin spec formal) | H-001 remediación SAST FOSCAL jul/2026 (SEC-001…SEC-020) · H-002 ajustes post-piloto |

## 1. Necesidad del cliente

El dictamen del auditor es claro: los controles de superficie (cabeceras, bcrypt, cookies,
whitelist de uploads, guards) existen, pero **la autorización no está en el núcleo, está en la
UI**. Un usuario autenticado de menor privilegio (rol AGENCIA) puede leer y alterar
correspondencia de otras dependencias. En un hospital eso es fuga de información entre áreas
y pérdida de integridad de la cadena de custodia documental (Ley 1581/2012).

## 2. Objetivo de negocio

Que **ningún usuario autenticado pueda ver ni alterar correspondencia, planillas o catálogos
fuera de su alcance**, que una sesión pueda **revocarse** de inmediato, que los **archivos** solo
se sirvan a quien tiene derecho sobre el objeto que los referencia, y que **toda operación
deje rastro** (quién, qué, cuándo).

## 3. Actores

| Actor | Alcance esperado |
|---|---|
| ADMIN | Global. Único que administra catálogos, usuarios, permisos y configuración. |
| MENSAJERO | Global sobre la operación logística (planillas, recorridos, lecturas). No aprueba ni devuelve en nombre de una agencia. |
| AGENCIA | Solo su agencia (`Usuario.agenciaId`). Registra/consulta correspondencia propia y aprueba/devuelve lo que le llega. Sin agencia asignada → alcance vacío (deniega por defecto). |
| Atacante interno | Usuario AGENCIA o MENSAJERO legítimo que manipula IDs, `FormData` o URLs. |
| Atacante externo | Sin sesión; o con cookie robada; o intentando fuerza bruta / credential stuffing. |

## 4. Alcance

**Incluye** los 23 hallazgos (A-01…A-06, M-01…M-08, B-01…B-09). **Excluye**: cifrado en
reposo, copias de seguridad y revisión de Caddy/PM2/PostgreSQL en el VPS (fuera del árbol de
código; el propio auditor los declara fuera de alcance). El envío real de correo (SMTP) se
deja preparado pero depende de credenciales del cliente (RADAR).

## 5. Criterios de aceptación (binarios)

| # | Criterio | Verificación |
|---|---|---|
| CA-1 | Un usuario AGENCIA no obtiene en ninguna página ni acción datos de otra agencia. | Tests de tenencia + smoke E2E con dos agencias. |
| CA-2 | Toda mutación por `id` de correspondencia/planilla verifica permiso **y** pertenencia; un ID ajeno devuelve error explícito (403), no redirección. | Tests unitarios de acciones con sesión simulada. |
| CA-3 | Las acciones de catálogos (ciudades, empresas, agencias) rechazan a no-ADMIN. | Test unitario + test estático de guard específico. |
| CA-4 | Una sesión revocada (logout, usuario borrado, rol cambiado) deja de servir en la siguiente petición. | Tests de `requireSession` con store simulado + E2E. |
| CA-5 | Ningún archivo subido es accesible sin sesión ni sin derecho sobre el objeto que lo referencia; el contenido se valida por magic bytes. | Tests de ruta `/api/uploads` y de `validateUploadFile`. |
| CA-6 | El login responde con el mismo tiempo exista o no el usuario, limita por IP y por usuario, y bloquea la cuenta tras N fallos de forma persistente. | Tests unitarios. |
| CA-7 | Las redirecciones del middleware solo apuntan a orígenes de la allowlist. | Tests de `resolveOrigin`. |
| CA-8 | La CSP de páginas usa nonce para scripts (sin `unsafe-inline` en `script-src`) y los colores de marca inválidos se descartan. | Test de headers + test de validación HSL + E2E sin errores de consola. |
| CA-9 | Toda operación de negocio y de administración escribe una fila en `AuditLog` con usuario, acción, entidad e IP. | Tests + revisión. |
| CA-10 | El seed no borra datos existentes, no contiene `123456` y se niega a correr en producción salvo bandera explícita. | Test estático + ejecución. |
| CA-11 | Roles, tipos y estados son enums de Prisma; `generatePlanillaAction` es transaccional; existen índices en columnas de filtro. | Migración + revisión + tests. |
| CA-12 | La suite de tests falla si un guard genérico (`requireSession`) sustituye al específico esperado en cada acción. | Test estático con mapa acción→guard. |
| CA-13 | No se puede crear/editar un usuario AGENCIA sin agencia; el email, si se ingresa, es válido. | Tests de esquema. |
| CA-14 | `cookie` eliminado de `package.json`; `panillas.ts` renombrado a `planillas.ts`; README y runbook reales (sin secretos ni IPs). | Revisión + build. |

## 6. Decisiones de diseño (gobiernan la implementación)

1. **Fuente de verdad del rol/agencia = base de datos en cada petición**, no el JWT. El JWT solo
   identifica la sesión (`sid`) y al usuario. `requireSession()` resuelve usuario y sesión en BD.
2. **Store de sesión en BD (`Sesion`)**: revocación real (logout, borrado, cambio de rol o de
   contraseña). Expiración **absoluta** de 24 h (se elimina la renovación rolling del middleware).
   El middleware (Edge) solo valida firma/expiración del JWT y redirige; la autorización real
   ocurre en servidor (layouts, páginas, acciones, API).
3. **Módulo único de tenencia `src/lib/tenancy.ts`**: construye los `where` de Prisma y verifica
   pertenencia de objetos. Ninguna página ni acción arma filtros de agencia por su cuenta.
4. **Denegación explícita**: acciones devuelven `{ error: "... (403)" }`; API devuelve 403;
   páginas de objeto ajeno responden 404 (sin enumeración); páginas de módulo sin permiso
   muestran "Acceso denegado". Todo intento denegado se registra en `AuditLog`.
5. **Archivos fuera de `public/`** (`UPLOADS_DIR`, por defecto `storage/uploads`), servidos
   únicamente por `/api/uploads` con ACL por objeto referenciante. Validación por magic bytes.
6. **Nuevos permisos**: `planillas.gestionar` (cerrar/reabrir/retirar/firma) y
   `correspondencia.recibir` (aprobar/devolver/procesar como agencia). Script idempotente
   `prisma/sync-permissions.ts` para bases existentes.
7. **Bitácora `AuditLog`** append-only desde la app (sin UPDATE/DELETE) + `createdBy/updatedBy`
   en Correspondencia y `createdBy` en Planilla.
8. **Enums Prisma** con migración SQL manual (`USING col::"Enum"`) para no perder datos.
9. **Rate limit** por IP (cabecera `X-Forwarded-For`, último salto = Caddy) y por usuario, con
   store intercambiable; **bloqueo persistente** en `Usuario.lockedUntil`. Redis queda en RADAR.
10. **CSP con nonce** generada en el middleware (`script-src 'self' 'nonce-…' 'strict-dynamic'`);
    `style-src` conserva `'unsafe-inline'` (requisito de Next/Radix; riesgo residual documentado).

## 7. Threat model resumido (STR-A13 en `threat-model.md`)

Ver `threat-model.md` para abuse cases AC-001…AC-015.

## 8. Contratos derivados

Ver `contracts.yaml` (C-001…C-016). Cada Tarea del Flujo implementa exactamente un Contrato.

## 9. Fuera de alcance / RADAR inicial

- R-020 AMARILLO: rate limit compartido (Redis) solo si se escala a más de un proceso.
- R-021 AMARILLO: envío real de correo requiere SMTP del cliente.
- R-022 AZUL: `style-src 'unsafe-inline'` permanece; mitigado por validación de HSL y ausencia de
  entrada de usuario en estilos.
- R-023 NARANJA: migración de archivos existentes de `public/uploads` al directorio privado debe
  ejecutarse en el despliegue (script `prisma/migrate-uploads.ts`).
