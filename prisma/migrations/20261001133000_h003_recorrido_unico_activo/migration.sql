-- H-003 · Guardian R-041 (condición de carrera en createRecorridoAction).
-- A lo sumo UN recorrido en estado INICIADO: índice único PARCIAL en PostgreSQL.
-- Prisma no modela índices parciales en el schema; esta migración es manual y
-- `prisma migrate deploy` la aplica sin problema. Si en el futuro `migrate dev`
-- propone eliminar este índice por "drift", NO aceptarlo (ver comentario en
-- schema.prisma, modelo Recorrido).

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT count(*) INTO n FROM "Recorrido" WHERE "estado" = 'INICIADO';
    IF n > 1 THEN
        RAISE EXCEPTION 'H-003: hay % recorridos INICIADO a la vez; cierre o anule los sobrantes antes de migrar', n;
    END IF;
END $$;

CREATE UNIQUE INDEX "Recorrido_unico_iniciado_idx" ON "Recorrido" ("estado") WHERE "estado" = 'INICIADO';
