#!/usr/bin/env bash
set -euo pipefail
# =============================================================================
# Aprovisionamiento idempotente de SISMAR en el VPS (pre-producción).
# Requiere variables ya exportadas (ver FASE C.2 del runbook):
#   POSTGRES_PASSWORD, JWT_SECRET   (SITE_DOMAIN es informativo)
#
# NOTA IMPORTANTE (corrección respecto al borrador del runbook):
#   Prisma CLI lee variables desde `.env` (NO desde `.env.local`).
#   Por eso escribimos los secretos en `.env` (que Next.js TAMBIÉN lee en
#   producción). Así `prisma migrate deploy` apunta al Postgres real (5433)
#   y no al placeholder committeado. `.env` está en .gitignore.
# =============================================================================
cd "$(dirname "$0")/.."

# ---- 0) Validar secretos requeridos ----------------------------------------
: "${POSTGRES_PASSWORD:?ERROR: exporta POSTGRES_PASSWORD antes de correr el script}"
: "${JWT_SECRET:?ERROR: exporta JWT_SECRET antes de correr el script}"
: "${SITE_DOMAIN:?ERROR: exporta SITE_DOMAIN (dominio público, p.ej. app.ejemplo.test) — alimenta ALLOWED_HOSTS}"

# ---- 1) Postgres (Docker, loopback :5433) ----------------------------------
printf 'POSTGRES_USER=sismar\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=sismar\n' \
  "$POSTGRES_PASSWORD" > .env.docker
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d

echo "== Esperando a que Postgres acepte conexiones =="
for i in $(seq 1 30); do
  if docker exec sismar_postgres pg_isready -U sismar -d sismar >/dev/null 2>&1; then
    echo "Postgres listo."; break
  fi
  [ "$i" = "30" ] && { echo "ERROR: Postgres no respondió a tiempo"; exit 1; }
  sleep 2
done

# ---- 2) `.env` de la app (secretos; NO se commitea) ------------------------
#     Lo leen tanto Prisma CLI como Next.js en producción.
cat > .env <<EOF
DATABASE_URL="postgresql://sismar:${POSTGRES_PASSWORD}@localhost:5433/sismar?schema=public"
# H-003 / C-009: solo se redirige a estos hosts (anti open-redirect)
ALLOWED_HOSTS="${SITE_DOMAIN}"
# H-003 / C-006: archivos subidos FUERA de public/, servidos solo por /api/uploads
UPLOADS_DIR="$(pwd)/storage/uploads"
JWT_SECRET="${JWT_SECRET}"
NODE_ENV=production
EOF
# Exportar también para el shell actual (build/prisma en este mismo proceso).
export DATABASE_URL="postgresql://sismar:${POSTGRES_PASSWORD}@localhost:5433/sismar?schema=public"
export JWT_SECRET

# ---- 3) Dependencias + migraciones -----------------------------------------
#     Se usa `npm install` (no `npm ci`) para tolerar dependencias opcionales
#     específicas de plataforma: el package-lock.json se genera en Windows y a
#     `npm ci` (estricto) le faltan deps de Linux (p. ej. @emnapi/* de Tailwind).
npm install --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate
# H-003: permisos nuevos (planillas.gestionar, correspondencia.recibir) y
# traslado de archivos legados de public/uploads al directorio privado.
npx tsx prisma/sync-permissions.ts
npx tsx prisma/migrate-uploads.ts

# ---- 4) Seed SOLO si la base está vacía (idempotente) ----------------------
#     H-003 / C-012: el seed es NO destructivo (upsert) y solo crea usuarios si la
#     tabla está vacía; aun así se mantiene la verificación por prudencia.
USERS=$(docker exec sismar_postgres psql -U sismar -d sismar -tAc \
  'SELECT count(*) FROM "Usuario";' 2>/dev/null || echo "0")
if [ "${USERS//[[:space:]]/}" = "0" ]; then
  echo "== Base vacía: ejecutando seed inicial =="
  npx tsx prisma/seed.ts
else
  echo "== La base ya tiene ${USERS} usuario(s): se OMITE el seed =="
fi

# ---- 5) Build + arranque con PM2 -------------------------------------------
npm run build
pm2 start deploy/ecosystem.config.cjs && pm2 save

echo "== Verificación local =="
sleep 3
curl -sI http://127.0.0.1:3002 | head -1
