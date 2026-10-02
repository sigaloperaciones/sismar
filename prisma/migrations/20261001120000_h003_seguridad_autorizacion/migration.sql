-- =============================================================================
-- H-003 · Remediación Auditoría de Seguridad y Arquitectura N.º 2 (31/08/2026)
-- Migración ESCRITA A MANO (no usar el SQL autogenerado por Prisma, que hace
-- DROP COLUMN + ADD COLUMN y PIERDE los datos de las columnas convertidas).
--
-- Contratos: C-001 (Sesion), C-008 (bloqueo de cuenta), C-011 (AuditLog y
-- autoría), C-013 (enums, índices).
--
-- Seguridad de datos: cada conversión TEXT → ENUM usa `USING col::"Enum"`.
-- Si alguna fila tuviera un valor fuera del dominio, PostgreSQL ABORTA la
-- migración completa (transaccional) y no se pierde nada. El bloque DO previo
-- informa exactamente qué valores habría que corregir.
-- =============================================================================

-- ── 0. Pre-chequeo de dominio (mensaje claro antes de convertir) ──────────────
DO $$
DECLARE
    malos TEXT;
BEGIN
    SELECT string_agg(DISTINCT v, ', ') INTO malos FROM (
        SELECT 'Usuario.role=' || "role" AS v FROM "Usuario" WHERE "role" NOT IN ('ADMIN','MENSAJERO','AGENCIA')
        UNION ALL SELECT 'RolPermiso.rol=' || "rol" FROM "RolPermiso" WHERE "rol" NOT IN ('ADMIN','MENSAJERO','AGENCIA')
        UNION ALL SELECT 'Correspondencia.tipo=' || "tipo" FROM "Correspondencia" WHERE "tipo" NOT IN ('ENTRANTE','SALIENTE')
        UNION ALL SELECT 'Correspondencia.importancia=' || "importancia" FROM "Correspondencia" WHERE "importancia" NOT IN ('NORMAL','ALTA')
        UNION ALL SELECT 'Correspondencia.estado=' || "estado" FROM "Correspondencia" WHERE "estado" NOT IN ('POR_ENTREGAR','ENTREGADA','DEVUELTA')
        UNION ALL SELECT 'Planilla.estado=' || "estado" FROM "Planilla" WHERE "estado" NOT IN ('GENERADA','CERRADA','PROCESADA')
        UNION ALL SELECT 'Planilla.tipo=' || "tipo" FROM "Planilla" WHERE "tipo" NOT IN ('ENTRANTE','SALIENTE')
        UNION ALL SELECT 'Recorrido.tipo=' || "tipo" FROM "Recorrido" WHERE "tipo" NOT IN ('AM','PM','EXCEPCIONAL')
        UNION ALL SELECT 'Recorrido.estado=' || "estado" FROM "Recorrido" WHERE "estado" NOT IN ('INICIADO','TERMINADO','ANULADO')
    ) t;
    IF malos IS NOT NULL THEN
        RAISE EXCEPTION 'H-003: valores fuera del dominio de los enums, corregir antes de migrar: %', malos;
    END IF;
END $$;

-- ── 1. Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MENSAJERO', 'AGENCIA');
CREATE TYPE "TipoCorrespondencia" AS ENUM ('ENTRANTE', 'SALIENTE');
CREATE TYPE "Importancia" AS ENUM ('NORMAL', 'ALTA');
CREATE TYPE "EstadoCorrespondencia" AS ENUM ('POR_ENTREGAR', 'ENTREGADA', 'DEVUELTA');
CREATE TYPE "EstadoPlanilla" AS ENUM ('GENERADA', 'CERRADA', 'PROCESADA');
CREATE TYPE "TipoRecorrido" AS ENUM ('AM', 'PM', 'EXCEPCIONAL');
CREATE TYPE "EstadoRecorrido" AS ENUM ('INICIADO', 'TERMINADO', 'ANULADO');

-- ── 2. Conversión de columnas conservando datos (USING) ───────────────────────
-- Usuario.role
ALTER TABLE "Usuario" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "Usuario" ALTER COLUMN "role" SET DEFAULT 'AGENCIA';

-- RolPermiso.rol (el índice único rol+permisoId se conserva)
ALTER TABLE "RolPermiso" ALTER COLUMN "rol" TYPE "Role" USING ("rol"::"Role");

-- Correspondencia.tipo / importancia / estado
ALTER TABLE "Correspondencia" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Correspondencia" ALTER COLUMN "tipo" TYPE "TipoCorrespondencia" USING ("tipo"::"TipoCorrespondencia");
ALTER TABLE "Correspondencia" ALTER COLUMN "tipo" SET DEFAULT 'ENTRANTE';

ALTER TABLE "Correspondencia" ALTER COLUMN "importancia" DROP DEFAULT;
ALTER TABLE "Correspondencia" ALTER COLUMN "importancia" TYPE "Importancia" USING ("importancia"::"Importancia");
ALTER TABLE "Correspondencia" ALTER COLUMN "importancia" SET DEFAULT 'NORMAL';

ALTER TABLE "Correspondencia" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Correspondencia" ALTER COLUMN "estado" TYPE "EstadoCorrespondencia" USING ("estado"::"EstadoCorrespondencia");
ALTER TABLE "Correspondencia" ALTER COLUMN "estado" SET DEFAULT 'POR_ENTREGAR';

-- Planilla.estado / tipo
ALTER TABLE "Planilla" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Planilla" ALTER COLUMN "estado" TYPE "EstadoPlanilla" USING ("estado"::"EstadoPlanilla");
ALTER TABLE "Planilla" ALTER COLUMN "estado" SET DEFAULT 'GENERADA';

ALTER TABLE "Planilla" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Planilla" ALTER COLUMN "tipo" TYPE "TipoCorrespondencia" USING ("tipo"::"TipoCorrespondencia");
ALTER TABLE "Planilla" ALTER COLUMN "tipo" SET DEFAULT 'ENTRANTE';

-- Recorrido.tipo / estado
ALTER TABLE "Recorrido" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Recorrido" ALTER COLUMN "tipo" TYPE "TipoRecorrido" USING ("tipo"::"TipoRecorrido");
ALTER TABLE "Recorrido" ALTER COLUMN "tipo" SET DEFAULT 'AM';

ALTER TABLE "Recorrido" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Recorrido" ALTER COLUMN "estado" TYPE "EstadoRecorrido" USING ("estado"::"EstadoRecorrido");
ALTER TABLE "Recorrido" ALTER COLUMN "estado" SET DEFAULT 'INICIADO';

-- ── 3. Columnas nuevas ────────────────────────────────────────────────────────
-- C-011: autoría
ALTER TABLE "Correspondencia" ADD COLUMN "createdBy" TEXT, ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Planilla" ADD COLUMN "createdBy" TEXT;

-- C-008: bloqueo persistente de cuenta
ALTER TABLE "Usuario" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
                      ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- ── 4. Tablas nuevas ──────────────────────────────────────────────────────────
-- C-001: store de sesión revocable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- C-011: bitácora append-only
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER,
    "username" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ── 5. Índices (C-013 — B-03) ─────────────────────────────────────────────────
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");
CREATE INDEX "Sesion_expiresAt_idx" ON "Sesion"("expiresAt");
CREATE INDEX "AuditLog_fecha_idx" ON "AuditLog"("fecha");
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");
CREATE INDEX "Correspondencia_estado_tipo_agenciaId_idx" ON "Correspondencia"("estado", "tipo", "agenciaId");
CREATE INDEX "Correspondencia_agenciaId_idx" ON "Correspondencia"("agenciaId");
CREATE INDEX "Correspondencia_planillaId_idx" ON "Correspondencia"("planillaId");
CREATE INDEX "Correspondencia_createdAt_idx" ON "Correspondencia"("createdAt");
CREATE INDEX "Planilla_estado_tipo_idx" ON "Planilla"("estado", "tipo");
CREATE INDEX "Planilla_agenciaId_idx" ON "Planilla"("agenciaId");
CREATE INDEX "Recorrido_estado_idx" ON "Recorrido"("estado");

-- ── 6. Claves foráneas ────────────────────────────────────────────────────────
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
