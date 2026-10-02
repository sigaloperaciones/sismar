# SISMAR — Runbook de operación (genérico, sin secretos)

Este documento describe **cómo** se opera SISMAR en cualquier entorno. No contiene
direcciones IP, puertos de servidores concretos, contraseñas ni dominios reales: esos
valores viven en el `.env` del servidor (fuera de git) y en la documentación interna
del proveedor de infraestructura.

## 1. Arquitectura de despliegue

```
Internet ──TLS──▶ Proxy inverso (Caddy/Nginx) ──▶ Node (Next.js, solo loopback) ──▶ PostgreSQL (solo loopback)
                                                     │
                                                     └─▶ Directorio privado de archivos (UPLOADS_DIR)
```

- Node **solo escucha en loopback** (`next start -H 127.0.0.1`). El proxy es el único
  expuesto y termina TLS.
- El proxy debe fijar `X-Forwarded-For` y `X-Forwarded-Proto` (Caddy lo hace por
  defecto y no confía en los valores entrantes).
- Un proceso PM2 (`deploy/ecosystem.config.cjs`) mantiene la app viva.

## 2. Variables de entorno (archivo `.env` en el servidor)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL (loopback). |
| `JWT_SECRET` | Sí | Aleatorio, mínimo 32 caracteres (la app no arranca con menos); recomendado `openssl rand -hex 64`. Rotarlo cierra todas las sesiones. |
| `ALLOWED_HOSTS` | Sí (prod) | Dominio(s) público(s) separados por coma. El middleware solo redirige a estos hosts. Sin él, tras un proxy las redirecciones apuntarían a localhost. |
| `UPLOADS_DIR` | Recomendada | Directorio privado de archivos, **fuera de `public/`**. Por defecto `<raíz>/storage/uploads`. |
| `NODE_ENV` | Sí | `production`. |
| `SEED_*_PASSWORD` | No | Solo para el seed inicial de una base vacía. |

## 3. Instalación inicial

1. Clonar el repositorio y copiar `.env.example` a `.env`; completar valores.
2. `npm install --no-audit --no-fund`
3. `npx prisma migrate deploy && npx prisma generate`
4. `npx tsx prisma/sync-permissions.ts` (catálogo de permisos).
5. Si la base está vacía: `npx tsx prisma/seed.ts`. El seed **no es destructivo** y
   muestra una sola vez las contraseñas generadas → guardarlas en un gestor seguro.
6. `npm run build` y arranque con PM2.
7. Verificar: `curl -I https://<dominio>/login` debe devolver `200`, cabeceras
   `Content-Security-Policy` (con `nonce-`) y `Strict-Transport-Security`;
   `curl -I https://<dominio>/reportes` debe devolver `307` a `/login`.

`deploy/setup-sismar.sh` automatiza los pasos 2 a 6 (requiere exportar
`POSTGRES_PASSWORD`, `JWT_SECRET` y `SITE_DOMAIN`).

## 4. Actualización (nueva versión)

Antes de migrar: `pg_dump` de la base (ver §7). Después: `npm audit --omit=dev` debe reportar 0 vulnerabilidades altas o críticas.

```bash
git pull
npm install --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/sync-permissions.ts     # permisos nuevos (idempotente)
npx tsx prisma/migrate-uploads.ts      # solo la primera vez tras H-003 (idempotente)
npm run build
pm2 restart sismar-app
```

### Migración H-003 (octubre 2026) — notas específicas

- La migración `20261001120000_h003_seguridad_autorizacion` convierte columnas de
  texto a **enums** conservando datos. Si existieran valores fuera del dominio, la
  migración **aborta** con el listado exacto de valores a corregir; no se pierde nada.
- Tras desplegar, **todas las sesiones anteriores dejan de ser válidas** (nuevo formato
  de sesión en BD): los usuarios deben volver a iniciar sesión.
- Ejecutar `prisma/migrate-uploads.ts` para mover archivos de `public/uploads` al
  directorio privado y reescribir las URLs. El directorio `public/uploads` queda
  bloqueado por el middleware (404) aunque conserve archivos.
- Añadir `ALLOWED_HOSTS` y `UPLOADS_DIR` al `.env`.
- Cuentas con hash heredado (coste 10) se re-hashean solas al iniciar sesión. Para
  comprobarlo: `SELECT username FROM "Usuario" WHERE password LIKE '$2_$10$%';` o
  rotarlas con `npx tsx prisma/rotate-passwords.ts <usuarios>`.
- La segunda migración de H-003 crea un índice único parcial (`Recorrido_unico_iniciado_idx`):
  solo puede existir un recorrido INICIADO. Si hubiera más de uno, la migración aborta con
  un mensaje claro; cerrar o anular los sobrantes antes.

## 5. Gestión de usuarios y sesiones

- Alta/edición en `/admin/usuarios` (rol ADMIN). Un usuario **AGENCIA** debe tener agencia.
- Cambiar rol, agencia o contraseña **revoca todas las sesiones** del usuario.
- Eliminar un usuario elimina sus sesiones; su bitácora se conserva (usuario → nulo).
- Rotación de contraseñas de usuarios semilla: `npx tsx prisma/rotate-passwords.ts`.
- Bloqueo de cuenta: 10 fallos consecutivos → 15 minutos. Un administrador puede
  desbloquear fijando una nueva contraseña.

## 6. Bitácora de auditoría

Tabla `AuditLog` (append-only). Acciones registradas: login (ok/fallido/bloqueado/
limitado), logout, accesos denegados, archivos denegados, creación/edición/aprobación/
devolución de correspondencia, ciclo de vida de planillas y recorridos, catálogos,
usuarios, permisos y configuración. Consulta de ejemplo:

```sql
SELECT fecha, username, accion, entidad, "entidadId", ip
FROM "AuditLog" WHERE accion IN ('ACCESO_DENEGADO','ARCHIVO_DENEGADO','LOGIN_BLOQUEADO')
ORDER BY fecha DESC LIMIT 100;
```

Recomendación: conservar al menos 12 meses y exportar periódicamente. La tabla es
append-only por convención de la aplicación; para hacerlo exigible en base de datos, usar
un rol de conexión para la app distinto del propietario y ejecutar
`REVOKE UPDATE, DELETE ON "AuditLog" FROM <rol_app>;`.

## 7. Copias de seguridad

- Base de datos: `pg_dump` diario (cifrado en destino). Probar restauración trimestral.
- Archivos: respaldar `UPLOADS_DIR` con la misma política.
- Nunca respaldar `.env` en claro.

## 8. Respuesta ante incidentes de sesión

- Compromiso de una cuenta: cambiar contraseña desde `/admin/usuarios` (revoca sesiones)
  y revisar `AuditLog` por `username`.
- Compromiso de `JWT_SECRET`: generar uno nuevo y reiniciar la app (invalida todos los
  tokens); además `UPDATE "Sesion" SET "revokedAt"=now() WHERE "revokedAt" IS NULL;`.
- Limpieza periódica: eliminar sesiones expiradas/revocadas con más de 7 días.

## 9. Verificación de seguridad antes de exponer un entorno (Gate Guardian)

1. `npm test` en verde, `npm run build` sin errores y `npm audit --omit=dev` sin altas ni críticas.
2. Sin secretos en el repo (`git ls-files | grep -i env` → solo `.env.example`).
3. `ALLOWED_HOSTS` configurado; `UPLOADS_DIR` fuera de `public/`.
4. Contraseñas semilla rotadas; ningún usuario con contraseña conocida.
5. Prueba con un usuario AGENCIA: no ve ni edita datos de otra agencia; `/admin` → 403.
6. Cabeceras CSP (nonce) y HSTS presentes; `/uploads/...` → 404; `/api/uploads` sin sesión → 401.
7. PoC de bypass de layouts (`tests/e2e/rsc-admin-bypass.poc.ts`) contra el entorno: sin fuga.
8. Ningún archivo subido por usuarios versionado en git (`git ls-files public/uploads` vacío).

---
By AISerNet Company
