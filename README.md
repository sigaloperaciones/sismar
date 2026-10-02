# SISMAR — Sistema de Gestión de Correspondencia Interna

Aplicación web para registrar, distribuir y trazar la correspondencia **entrante** y
**saliente** de una organización con varias dependencias (agencias): planillas de
entrega, recorridos de mensajería, confirmación de recibido por cada agencia,
reportes y administración de catálogos, usuarios y permisos.

> Desarrollado por **AISerNet Company** (Equipo ASIA) bajo la metodología **STRATA v3**.
> Las remediaciones de seguridad se documentan en `docs/auditoria/` y las Specs de
> cada Flujo en `specs/`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix/shadcn |
| Backend | Server Actions + Route Handlers de Next.js, Zod, `jose` (JWT HS256), `bcryptjs` |
| Datos | PostgreSQL 16 + Prisma 5 |
| Tests | Vitest (suite de seguridad en `tests/security/`) |

## Modelo de seguridad (resumen)

- **Autenticación**: login con límite por usuario e IP, bloqueo persistente de cuenta y
  respuesta de tiempo constante. Sesión en base de datos (`Sesion`) referenciada por un
  JWT en cookie `httpOnly`/`secure`/`sameSite`; **revocable** (logout, cambio de rol o
  contraseña, eliminación de usuario). Expiración absoluta de 24 h.
- **Autorización en el servidor**: rol y agencia se leen de la base de datos en cada
  petición. Permisos granulares (`Permiso`/`RolPermiso`/`UsuarioPermiso`) y **tenencia
  por agencia** (`src/lib/tenancy.ts`) aplicados en páginas, server actions y API.
- **Archivos**: fuera de `public/`, servidos únicamente por `/api/uploads` con sesión y
  ACL por objeto; whitelist PDF/PNG/JPG, 10 MB y validación por *magic bytes*.
- **Cabeceras**: CSP con nonce por petición, HSTS, nosniff, frame-options, etc.
- **Bitácora**: tabla `AuditLog` append-only con usuario, acción, entidad, detalle e IP.

## Requisitos

- Node.js 20+ y npm.
- PostgreSQL 16 (local o en Docker).

## Puesta en marcha local

```bash
npm install
cp .env.example .env            # edite DATABASE_URL, JWT_SECRET y, si aplica, ALLOWED_HOSTS/UPLOADS_DIR
npx prisma migrate deploy       # aplica las migraciones
npx prisma generate
npx tsx prisma/seed.ts          # NO destructivo; solo crea usuarios si la tabla está vacía
npm run dev
```

El seed **no incluye contraseñas conocidas**: las toma de `SEED_*_PASSWORD` o genera
contraseñas fuertes y las muestra una sola vez en consola.

## Scripts de operación

| Comando | Para qué |
|---|---|
| `npm run build` / `npm start` | Build y arranque en producción |
| `npm test` | Suite de tests (seguridad, autorización, tenencia, archivos, login, guards de página) |
| `npm audit --omit=dev` | Debe reportar 0 vulnerabilidades altas/críticas antes de desplegar |
| `npx tsx tests/e2e/rsc-admin-bypass.poc.ts` | PoC manual: los layouts de Next no son frontera; cada página tiene guard propio |
| `npx prisma migrate deploy` | Aplicar migraciones pendientes |
| `npx tsx prisma/seed.ts` | Seed no destructivo (catálogos, permisos, usuarios iniciales) |
| `npx tsx prisma/sync-permissions.ts` | Sincronizar el catálogo de permisos en una base existente |
| `npx tsx prisma/migrate-uploads.ts [--dry-run]` | Mover archivos legados de `public/uploads` al directorio privado y reescribir URLs |
| `npx tsx prisma/rotate-passwords.ts [usuarios…]` | Rotar contraseñas de usuarios semilla y revocar sus sesiones |

## Variables de entorno

Ver `.env.example`. Las imprescindibles en producción: `DATABASE_URL`, `JWT_SECRET`,
`ALLOWED_HOSTS` (dominio público; evita redirecciones a hosts arbitrarios) y
`UPLOADS_DIR` (directorio privado de archivos, fuera de `public/`).

## Estructura

```
src/app/(auth)/login          Pantalla de acceso
src/app/(dashboard)/…         Módulos: correspondencia, planillas, recorridos, reportes, admin
src/app/actions/*.ts          Server actions (cada una con su guard y bitácora)
src/app/api/uploads           Entrega de archivos con ACL
src/app/api/auth/expired      Cierre de sesiones inválidas
src/lib/auth-guard.ts         requireSession / requirePermission / requireAdmin
src/lib/tenancy.ts            Alcance por agencia
src/lib/session-store.ts      Sesiones revocables en BD
src/lib/uploads.ts            Validación y almacenamiento de archivos
src/lib/audit.ts              Bitácora
prisma/                       Schema, migraciones y scripts
specs/H-NNN/                  Specs STRATA (SDD), threat model, contratos, escenarios BDD
docs/                         Operación, auditorías y respuestas
tests/security/               Tests de seguridad
```

## Operación y despliegue

Ver `docs/OPERACION.md` (runbook genérico, sin secretos). La configuración concreta de
cada entorno vive fuera del repositorio.

---
By AISerNet Company
