# STR-A13 · Threat Model y Abuse Cases — Flujo H-003

Revisión de la Capa Guardian (Claude Fable 5.1); firma humana: Mauricio Tarazona.

## Activos
Correspondencia (datos personales de remitentes/destinatarios, asuntos), planillas (cadena de
custodia), archivos (guías, soportes firmados), cuentas y sesiones, catálogos maestros.

## Fronteras de confianza
Internet → Caddy (TLS) → Node (loopback) → PostgreSQL (loopback). El navegador es hostil; las
`server actions` son endpoints públicos que solo exigen una cookie válida.

## Abuse Cases

| Código | Abuso | Control esperado | Contrato |
|---|---|---|---|
| AC-001 | AGENCIA abre `/reportes`, `/planillas`, `/recorridos` y ve datos de todas las agencias. | Filtro de tenencia obligatorio en toda consulta. | C-002, C-007 |
| AC-002 | AGENCIA envía `updateMailAction` con `id` de otra agencia y `tipo` manipulado. | Cargar el registro, usar su `tipo` real, verificar pertenencia → 403. | C-003 |
| AC-003 | MENSAJERO invoca `aprobarCorrespondenciaAction(id)` y marca entregado sin que la agencia reciba. | Permiso `correspondencia.recibir` (no lo tiene) + pertenencia. | C-003 |
| AC-004 | AGENCIA llama `closePlanillaAction`/`reopenPlanillaAction` de planillas ajenas. | Permiso `planillas.gestionar` + pertenencia. | C-004 |
| AC-005 | AGENCIA llama `createAgenciaAction` directamente (la UI la oculta). | `requireAdmin()` en toda acción de catálogo. | C-005 |
| AC-006 | Admin degradado a AGENCIA sigue usando su cookie 24 h; usuario borrado sigue operando. | Rol/agencia leídos de BD por petición; sesión en BD revocada al cambiar rol o borrar. | C-001 |
| AC-007 | Cookie robada: la víctima cierra sesión pero el atacante sigue dentro. | Logout revoca `Sesion` en servidor. | C-001 |
| AC-008 | Enlace directo `/uploads/<archivo>.pdf` sin sesión. | Archivos fuera de `public/`; middleware ya no exime `/uploads`. | C-006 |
| AC-009 | Usuario autenticado adivina nombres `/api/uploads?filename=…` de otras agencias. | ACL por objeto referenciante; 403/404. | C-006 |
| AC-010 | Polyglot `image/jpeg` con contenido HTML/JS. | Magic bytes + `nosniff` + `Content-Disposition` + CSP `default-src 'none'` en la respuesta. | C-006 |
| AC-011 | Enumeración de usuarios por tiempo de respuesta; credential stuffing con muchos usuarios desde una IP. | bcrypt dummy; límite por IP; bloqueo persistente por cuenta. | C-008 |
| AC-012 | Petición con `Host: atacante.com` directa a Node → redirección a dominio hostil. | Allowlist de hosts. | C-009 |
| AC-013 | Admin (o compromiso de su cuenta) guarda `colorPrimary` con `}</style><script>` → XSS global. | Validación HSL en Zod y en el inyector; CSP con nonce. | C-010 |
| AC-014 | Operador ejecuta `prisma db seed` en producción y borra todo dejando `admin/123456`. | Seed no destructivo, sin credenciales fijas, bloqueado en producción. | C-012 |
| AC-015 | Dos clics concurrentes en "Asignar" duplican ítems en planillas. | Transacción + `updateMany` filtrado por estado. | C-013 |

## Riesgos aceptados / residuales
- `style-src 'unsafe-inline'` (Next/Radix). Mitigación: validación de HSL, sin estilos derivados de entrada de usuario.
- Rate limit en memoria por proceso (instancia única PM2). Mitigación: bloqueo persistente en BD.

## Abuse Cases añadidos por la revisión Guardian independiente (01/10/2026)

| Código | Abuso | Control esperado | Contrato |
|---|---|---|---|
| AC-016 | AGENCIA (o cookie REVOCADA aún firmada) pide `/admin/usuarios` con `RSC: 1` y un `Next-Router-State-Tree` que declara los layouts `(dashboard)` y `admin` ya renderizados → el servidor ejecuta solo la página. | Guard PROPIO en cada `page.tsx` (`requireAdminPage`); el layout es defensa adicional; test estático `page-guards`; PoC RSC. | C-005, C-007 |
| AC-017 | Explotación de CVE publicados de Next.js (RCE en Image Optimizer, bypass de middleware, XSS con nonce, CSRF de Server Actions). | `next` ≥ 16.3.3 (instalado 16.3.8), `overrides` para transitivas, `npm audit --omit=dev` sin altas/críticas antes de desplegar. | transversal |
| AC-018 | AGENCIA con una pieza en una planilla SALIENTE descarga el soporte firmado (hoja impresa con las piezas de TODAS las agencias). | ACL de firma saliente solo alcance global; `FirmaPreview` oculto a AGENCIA en salientes. | C-002, C-006 |
| AC-019 | AGENCIA con `planillas.gestionar` delegado cierra/reabre/reemplaza la firma de una saliente compartida (marca ENTREGADO lo de las demás). | `assertPlanillaManage`: salientes solo GLOBAL; lectura con `assertPlanillaAccess`. | C-004 |
| AC-020 | Enumeración de cuentas por tiempo: hash heredado de coste 10 responde más rápido que el relleno de coste 12. | `needsRehash` + re-hash transparente a coste 12 tras login; rotación de cuentas heredadas en el VPS. | C-008 |
| AC-021 | Fórmula `=HYPERLINK(...)` en un asunto se ejecuta en el Excel de quien exporta el reporte. | `csvCell` neutraliza celdas que empiezan por `= + - @ \t \r`. | C-003 |
| AC-022 | Doble clic / dos sesiones aprueban la misma pieza o abren dos recorridos INICIADO. | `updateMany` condicionado al estado; transacción; índice único parcial en `Recorrido`. | C-013 |
