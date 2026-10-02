# STR-A05 · Registro RADAR — Flujo H-003 (actualizado 01/10/2026, tras revisión Guardian independiente)

## Hallazgos de la revisión Guardian independiente (R-027 … R-042) y su cierre

| Código | Color | Riesgo | Contrato / AC | Respuesta | Estado |
|---|---|---|---|---|---|
| R-027 | ROJO→cerrado | `next` 16.0.8 con avisos publicados (RCE en Image Optimizer, bypass de middleware, XSS con nonce, CSRF de Server Actions); transitivas postcss/sharp/nanoid. | transversal · AC-017 | `next`/`eslint-config-next` → **16.3.8**; `overrides.nanoid ^3.3.18`; `npm audit --omit=dev` → **0 vulnerabilidades**. Tests, build y E2E repetidos. | **Cerrado** |
| R-028 | ROJO→cerrado | Las 11 páginas `/admin/*` dependían solo del layout; una petición RSC con `Next-Router-State-Tree` omite layouts → AGENCIA o cookie revocada leería usuarios, correos, permisos, NIT. | C-005, C-007 · AC-016 | `requireAdminPage()` en **cada** `page.tsx` admin; test estático `page-guards.test.ts` (todo `page.tsx` bajo `(dashboard)` con guard propio ANTES de Prisma); PoC RSC ejecutado (`storage/e2e-rsc-bypass.ts`). | **Cerrado** |
| R-029 | ROJO→parcial | 4 PDFs versionados en `public/uploads` desde el commit inicial (2 facturas personales de un tercero); runbook interno con credencial por defecto. | C-006, C-012 · Ley 1581 | `git rm --cached public/uploads` (ya no se versionan; `.gitignore`); literales de contraseña saneados en `docs/`; test `no-hardcoded-credentials` barre `docs/` y `deploy/`. **Pendiente decisión humana:** purgar el historial (`git filter-repo`) en los tres remotos (origin, sigal, foscal) y evaluar notificación bajo Ley 1581 — acción destructiva coordinada con el cliente. | **Abierto (decisión Mauricio)** |
| R-030 | AZUL→cerrado | Firma de planilla SALIENTE (hoja impresa con TODAS las agencias) legible por cualquier AGENCIA con una pieza en ella. | C-002, C-006 · AC-018 | ACL de firma saliente solo alcance global (`upload-access.ts`); `FirmaPreview` y `UploadFirmaForm` ocultos a AGENCIA en salientes; test. | **Cerrado** |
| R-031 | AZUL→cerrado | Con `planillas.gestionar` delegado, una AGENCIA cerraba/reabría/firmaba una saliente compartida. | C-004 · AC-019 | `assertPlanillaManage` (salientes solo GLOBAL) en cerrar/reabrir/firma; lectura sigue con `assertPlanillaAccess`; test. | **Cerrado** |
| R-032 | AZUL | Hashes heredados de coste 10 responden más rápido que el relleno (coste 12): oráculo de tiempo invertido. | C-008 · AC-020 | `needsRehash` + re-hash transparente a coste 12 tras login correcto (solo cubre cuentas que vuelven a entrar); `rotate-passwords` usa 12. **En el VPS:** `SELECT username FROM "Usuario" WHERE password LIKE '$2_$10$%'` debe devolver 0 filas o ejecutar `rotate-passwords` para las que aparezcan. | **Abierto (verificación en VPS)** |
| R-033 | AZUL→cerrado | `updateMailAction` consultaba la BD antes de autenticar (oráculo de existencia de IDs). | C-003 | `requireSession()` primero; `assertPermission(ctx, …)` con el tipo real; test exige guard antes de `prisma.`. | **Cerrado** |
| R-034 | AZUL→cerrado | Edición de piezas en cualquier estado; bitácora sin valores previos. | C-003, C-011 | Solo se edita POR_ENTREGAR y sin planilla; `AuditLog.detalle.antes` con el estado anterior; tests. | **Cerrado** |
| R-035 | AZUL→cerrado | `checkPlanillasAbiertas` devolvía conteos globales con solo sesión. | C-002 | `requirePermission(RECORRIDOS_VER)` + `planillaWhere`. | **Cerrado** |
| R-036 | VIOLETA→cerrado | Falsa cobertura: permisos buscados en comentarios; sin tests de guards de página, de login ni de revocación. | C-014 | Comentarios eliminados antes de comparar; `page-guards.test.ts`; `login-action.test.ts` (comportamiento con Prisma/bcrypt); `admin-actions.test.ts` (revocación al cambiar rol/contraseña). | **Cerrado** |
| R-037 | AZUL→cerrado | Inyección de fórmulas en la exportación CSV. | A03 | `src/lib/csv.ts` (`csvCell`) en `ReportView`; test. | **Cerrado** |
| R-038 | AMARILLO | Bloqueo de cuenta sobre nombres fijos permite dejar `admin` bloqueado (DoS de login). | C-008 | Decisión: se mantiene el bloqueo (exigido por el auditor); mitigación: límite por IP, renombrar `admin` en el despliegue y alertar ante `LOGIN_BLOQUEADO`; evaluar bloqueo por (usuario, IP) con retardo progresivo. | Abierto (monitoreado) |
| R-039 | AZUL→cerrado | Seed con `SEED_*_PASSWORD` inválida generaba otra clave sin imprimirla. | C-012 | El seed aborta (exit 3) si la variable no cumple la política; test. | **Cerrado** |
| R-040 | AZUL→cerrado | Alta sin topes de longitud ni de anexos. | C-003 | `.max()` en esquemas de alta; `MAX_ANEXOS = 50`; tests. | **Cerrado** |
| R-041 | AZUL→cerrado | Carreras verificar-luego-actualizar (doble aprobación; dos recorridos INICIADO). | C-013 | `updateMany` condicionado al estado + `count`; transacción al crear recorrido; índice único PARCIAL `Recorrido_unico_iniciado_idx` (migración `20261001133000`). | **Cerrado** |
| R-042 | INFO | (1) `/api/auth/expired` GET sin CSRF (solo borra cookie, no revoca). (2) logo `/\host`. (3) CSP solo en middleware. (4) AuditLog append-only por convención. (5) `LOGIN_FALLIDO` guardaba el usuario tecleado. (6) `e.message` de Prisma en logs. (7) AccessDenied responde 200. (8) `/login` por prefijo. | varios | Cerrados: (2) regex `/^\/(?![\/\\])/`; (5) `anonymizeUsername` (SHA-256 truncado); (8) comparación exacta. Aceptados/documentados: (1) impacto = cierre de sesión local; (3) bypass de middleware parchado en 16.3.8; (4) runbook recomienda rol de BD sin UPDATE/DELETE sobre AuditLog; (6) revisar mensajes en producción; (7) semántica de UI. | Parcial (documentado) |

### Menores de la re-verificación Guardian (01/10/2026)

| Código | Color | Riesgo | Respuesta | Estado |
|---|---|---|---|---|
| R-043 | VIOLETA→cerrado | El test de credenciales exigía el literal entre comillas: `docs/DEPLOY_VPS_HOSTINGER_SISMAR.md` seguía diciendo "usuarios por defecto 123456". | Línea saneada; regex `/(?<![A-Za-z0-9])123456(?![0-9])/` sin exigir comillas (barre src/, prisma/, docs/, deploy/). | **Cerrado** |
| R-044 | INFO→cerrado | `anonymizeUsername` usaba SHA-256 sin sal truncado: una contraseña tecleada en el campo de usuario podía recuperarse por diccionario desde la bitácora. | HMAC-SHA256 con secreto del servidor (derivado de `JWT_SECRET`). | **Cerrado** |
| R-045 | INFO→cerrado | `next` declarado como `^16.3.8`: `npm install` en el VPS podía resolver otra 16.x distinta de la probada. | Versión EXACTA `16.3.8` en `next` y `eslint-config-next`. | **Cerrado** |
| R-046 | INFO→cerrado | Cerrar/reabrir/procesar planilla verificaban el estado y luego actualizaban sin condición. | `updateMany` condicionado al estado actual + `count`; tests ajustados. | **Cerrado** |
| R-047 | AZUL | Remoto `sigal` (espejo interno) contiene en su historial los PDFs y el runbook con IP. | Confirmar si es destinatario autorizado de datos del cliente; incluirlo en la decisión de purga (R-029). | Abierto (decisión Mauricio) |

### Hallazgos del documentador (lectura cruzada código ↔ manuales, 01/10/2026)

| Código | Color | Riesgo | Respuesta | Estado |
|---|---|---|---|---|
| R-048 | AZUL→cerrado | `removeCorrespondenciaFromPlanillaAction` verificaba la pieza pero no la planilla: una AGENCIA con `planillas.gestionar` delegado podía retirar su pieza de una saliente compartida. | `assertPlanillaManage` sobre la planilla de la pieza; test. | **Cerrado** |
| R-049 | VIOLETA | Los permisos `admin.*` existen en la matriz pero ningún guard los consulta: la administración se gobierna por el rol ADMIN (`requireAdmin`). Ambigüedad entre lo configurable y lo aplicado. | Decisión de diseño explícita: `/admin` = rol ADMIN; los `admin.*` quedan informativos hasta que un Flujo futuro los aplique (o se retiren de la matriz). Documentado en manual técnico. | Abierto (Spec futura) |
| R-050 | AMARILLO→cerrado | La UI anunciaba "Se enviará un correo" sin proveedor configurado (R-021). | Texto condicionado al servicio de correo. | **Cerrado** |
| R-051 | AMARILLO | UX: "Agregar planillas al recorrido" falla con error genérico si ya hay una planilla procesada, y el contador incluye planillas ya en el recorrido; al completar una pieza, los anexos nuevos reemplazan a los existentes sin mostrarlos. | Funcional, preexistente; registrar para un Pulso de UX. | Abierto |
| R-052 | AZUL→cerrado | `JWT_SECRET` sin longitud mínima en código; docs inconsistentes (32 vs 64). | La app exige ≥ 32 caracteres (recomendado `openssl rand -hex 64`); docs alineadas. | **Cerrado** |
| R-053 | AMARILLO→cerrado | Falta el crédito obligatorio "By AISerNet Company" (NEBULA 10 pt) en la interfaz. | Pie del login con NEBULA embebida (`public/fonts/NEBULA-Regular.otf`). | **Cerrado** |
| R-054 | AMARILLO | Archivos huérfanos al reemplazar guía/firma (no se sirven, pero ocupan disco); búsqueda de reportes sensible a mayúsculas y limitada a 100 filas. | Script de limpieza y `mode: 'insensitive'` en un Pulso de mantenimiento. | Abierto |

## Riesgos previos del Flujo

| Código | Color | Riesgo | Contrato | Respuesta / Plan | Estado |
|---|---|---|---|---|---|
| R-020 | AMARILLO | Contador de rate limit por ventana en memoria del proceso (instancia única PM2). | C-008 | Bloqueo persistente de cuenta en BD cubre reinicios. `RateLimitStore` sobre Redis si se escala. | Abierto (monitoreado) |
| R-021 | AMARILLO | Envío real de correo depende de SMTP del cliente. | C-011 | `setMailProvider` listo. | Abierto |
| R-022 | AZUL | `style-src 'unsafe-inline'` permanece. | C-010 | Requisito de Next/Radix; colores validados en entrada y salida. Riesgo aceptado por Guardian. | Aceptado |
| R-023 | NARANJA | Archivos legados en `public/uploads` del VPS hasta ejecutar `migrate-uploads`. | C-006 | Middleware responde 404 a `/uploads/*`; paso del runbook. | Abierto hasta el despliegue |
| R-024 | AMARILLO | Cobertura medida solo en `src/lib` (80,2 %). | C-014 | Páginas validadas por build + E2E + test estático de guards. | Abierto |
| R-025 | AMARILLO | Subida de archivo desde la UI sin E2E en esta sesión. | C-006 | `saveUploadedFile` probado sobre disco; `/api/uploads` E2E. Verificar en pre-producción. | Abierto |
| R-026 | AMARILLO | Al desplegar, todas las sesiones previas quedan inválidas. | C-001 | Comunicar a usuarios. | Abierto hasta el despliegue |

Cerrados en este Flujo: R-010…R-019 (hallazgos A-01…B-09) y R-027, R-028, R-030…R-037, R-039…R-041 (revisión Guardian). Evidencia en `STR-A03_Acta_de_Cierre.md`.
