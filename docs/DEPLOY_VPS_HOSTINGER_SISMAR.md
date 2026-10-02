# Runbook — Sincronizar con GitHub y desplegar SISMAR (pre-producción) en VPS Hostinger

> **Para quién es esto:** este documento está escrito para que **la sesión de Claude Code
> del proyecto SISMAR** lo siga paso a paso, junto con Mauricio. Replica el patrón ya
> probado y funcionando de CLINITURNO/NextLine (`fafos.aisernet.tech`) en el **mismo VPS**,
> pero para SISMAR, con acceso final en **`https://sismar.aisernet.tech`**.
>
> **Metodología STRATA v3 (obligatoria):** cada fase cierra con una **verificación real**
> (Gate). No se declara "verde" nada sin evidencia ejecutada. La **Capa Guardian** (seguridad)
> es transversal: hay un RADAR al final con los riesgos vivos. Responder siempre en español.

---

## 0. Contexto y decisiones de arquitectura (leer antes de tocar nada)

**Stack real de SISMAR** (verificado en el repo):
- **Next.js 16** (App Router) — una sola app web (sin kiosco, sin impresora, sin TVs; mucho más simple que CLINITURNO).
- **Prisma + PostgreSQL** (`datasource provider = postgresql`).
- **Auth JWT con `jose`** (variable `JWT_SECRET`) + `bcryptjs` para hashes.
- Seed con `tsx prisma/seed.ts`.
- Repos Git remotos ya configurados:
  - `origin` → `https://github.com/AISerNet-Company/SISMAR.git` ← **fuente de verdad para el deploy**
  - `foscal` → `https://github.com/FoscalDev/SISMAR.git` (del cliente; **no** se usa para desplegar)
  - Rama de trabajo: **`main`**.

**El VPS ya está ocupado por CLINITURNO/NextLine.** SISMAR debe COEXISTIR sin pisarlo.
Reglas de convivencia (⚠️ críticas):

| Recurso            | CLINITURNO (existente) | **SISMAR (nuevo) — usar estos** |
|--------------------|------------------------|---------------------------------|
| Dominio            | `fafos.aisernet.tech`  | **`sismar.aisernet.tech`**      |
| Puerto app (PM2)   | `127.0.0.1:3001`       | **`127.0.0.1:3002`**            |
| Proceso PM2        | `cliniturno-app`       | **`sismar-app`**                |
| Contenedor Postgres| `cliniturno_postgres`  | **`sismar_postgres`**           |
| Puerto Postgres    | `127.0.0.1:5432`       | **`127.0.0.1:5433`** (loopback) |
| Carpeta en VPS     | `~/cliniturno/...`     | **`~/sismar`**                  |

**Topología resultante**
```
                 Internet (HTTPS 443)
                        │
                 ┌──────▼──────┐   VPS Hostinger 177.7.52.163
                 │    Caddy    │   (un solo Caddy; auto-TLS por subdominio)
                 └──┬───────┬──┘
   fafos.aisernet   │       │   sismar.aisernet.tech
     → :3001        │       │     → :3002
              ┌─────▼─┐  ┌──▼────┐
              │ CLINI │  │ SISMAR│  PM2 (sismar-app)
              └───────┘  └──┬────┘
                            │ 127.0.0.1:5433 (loopback)
                        ┌───▼────┐
                        │Postgres│  Docker sismar_postgres (NO expuesto)
                        └────────┘
```

> Claude **no** tiene acceso SSH al VPS: prepara y verifica los artefactos localmente;
> **Mauricio ejecuta los comandos por SSH** y pega la salida para verificar cada Gate.

---

## FASE A — Sincronización con GitHub (local, en la PC de trabajo)

**Objetivo:** que `origin/main` sea la fuente de verdad y que el VPS pueda `git pull` desde ahí.

### A.1 Verificar estado local
```bash
cd C:\Atgvt\SISMAR\SISMAR
git status
git remote -v          # confirma que 'origin' = AISerNet-Company/SISMAR
git branch --show-current   # debe decir: main
```

### A.2 Confirmar que los secretos NO se versionan
`.gitignore` ya excluye `.env.local`, `*.db`, `prisma/*.db`. **Verificar** que ningún
`.env` con secretos reales esté trackeado:
```bash
git ls-files | grep -E "\.env" || echo "OK: ningun .env trackeado"
```
> Si aparece `.env` (sin `.local`) trackeado, revisar su contenido. El repo trae `.env`
> con `JWT_SECRET=your-super-secret...` y `DATABASE_URL` de ejemplo — es un placeholder, no
> un secreto real, pero **conviene renombrarlo a `.env.example` únicamente** y sacar `.env`
> del control de versiones para evitar confusiones. (Registrar en RADAR si se cambia.)

### A.3 Subir la rama a origin
```bash
git add -A
git commit -m "chore(deploy): runbook de despliegue pre-prod en VPS (sismar.aisernet.tech)"
git push origin main
```

**✅ Gate A (verificar):** abrir `https://github.com/AISerNet-Company/SISMAR/tree/main`
y confirmar que el último commit aparece. Sin esto, no seguir.

---

## FASE B — Preparar artefactos de despliegue en el repo (local, con Claude)

SISMAR **todavía no tiene** carpeta `deploy/`. Claude debe crear estos 4 archivos,
commitearlos y subirlos (así el VPS los obtiene con `git pull`). Están parametrizados
para el puerto **3002** y Postgres **5433**.

### B.1 `docker-compose.prod.yml` (Postgres solo en loopback)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sismar_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "127.0.0.1:5433:5432"     # SOLO loopback; nunca 0.0.0.0
    volumes:
      - sismar_pgdata:/var/lib/postgresql/data
volumes:
  sismar_pgdata:
```

### B.2 `deploy/ecosystem.config.cjs` (PM2, puerto 3002)
```js
module.exports = {
  apps: [{
    name: 'sismar-app',
    cwd: __dirname + '/..',            // raíz del repo SISMAR
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    env: { NODE_ENV: 'production', PORT: '3002' },
    max_restarts: 10,
    restart_delay: 3000,
  }],
}
```

### B.3 `deploy/Caddyfile.sismar` (fragmento a añadir al Caddy del VPS)
```
sismar.aisernet.tech {
    encode gzip
    reverse_proxy 127.0.0.1:3002
}
```
> **No reemplazar** el Caddyfile existente de CLINITURNO: este bloque se **añade** al
> mismo `/etc/caddy/Caddyfile` (Caddy sirve múltiples sitios en un solo archivo).

### B.4 `deploy/setup-sismar.sh` (aprovisionamiento idempotente)
```bash
#!/usr/bin/env bash
set -euo pipefail
# Requiere variables ya exportadas (ver FASE C.2): SITE_DOMAIN, POSTGRES_PASSWORD, JWT_SECRET
cd "$(dirname "$0")/.."

# 1) Postgres (Docker, loopback :5433)
printf 'POSTGRES_USER=sismar\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=sismar\n' "$POSTGRES_PASSWORD" > .env.docker
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
sleep 5

# 2) .env.local de la app (secretos; NO se commitea)
cat > .env.local <<EOF
DATABASE_URL="postgresql://sismar:${POSTGRES_PASSWORD}@localhost:5433/sismar?schema=public"
JWT_SECRET="${JWT_SECRET}"
NODE_ENV=production
EOF

# 3) Dependencias + migraciones + seed (⚠ ver RADAR sobre el seed)
npm ci
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts    # SOLO en base vacía; desde H-003 el seed NO fija contraseñas (las genera o las toma del entorno)

# 4) Build + arranque con PM2
npm run build
pm2 start deploy/ecosystem.config.cjs && pm2 save

echo "== Verificacion local =="
sleep 3
curl -sI http://127.0.0.1:3002 | head -1
```

### B.5 Commit + push de los artefactos
```bash
git add docker-compose.prod.yml deploy/ docs/DEPLOY_VPS_HOSTINGER_SISMAR.md
git commit -m "feat(deploy): artefactos VPS SISMAR (Caddy+PM2+Postgres, puerto 3002/5433)"
git push origin main
```

**✅ Gate B:** los 4 archivos aparecen en `origin/main` en GitHub.

---

## FASE C — Despliegue en el VPS (Mauricio, por SSH)

### C.1 DNS (una sola vez, en el panel del dominio `aisernet.tech`)
Crear registro **A**: `sismar` → `177.7.52.163`.
Verificar propagación (desde la PC local):
```bash
nslookup sismar.aisernet.tech      # debe resolver a 177.7.52.163
```

### C.2 Clonar y definir secretos en el VPS
```bash
ssh usuario@177.7.52.163
cd ~ && git clone https://github.com/AISerNet-Company/SISMAR.git sismar
cd sismar/SISMAR                      # el proyecto vive en la subcarpeta SISMAR/

export SITE_DOMAIN="sismar.aisernet.tech"
export POSTGRES_PASSWORD="$(openssl rand -base64 32)"
export JWT_SECRET="$(openssl rand -hex 64)"
# Guardar estos 2 secretos en un gestor seguro (los necesitarás para futuros redeploys).
```
> Autenticación de git en el VPS: usuario `aisernet` + **PAT** (Personal Access Token) del
> repo `AISerNet-Company/SISMAR`, igual que en CLINITURNO. Si el clone pide credenciales,
> usar el PAT como contraseña.

### C.3 Aprovisionar
> Docker, Node 20 y PM2 ya están instalados en el VPS (los dejó CLINITURNO). Caddy también.
> Por eso el script de SISMAR **no** reinstala infraestructura; solo levanta lo suyo.
```bash
bash deploy/setup-sismar.sh        # revisar el script antes de correrlo
```

### C.4 Añadir el sitio a Caddy y recargar
```bash
# Añadir el bloque de sismar al Caddyfile global (sin borrar el de fafos):
cat deploy/Caddyfile.sismar | sudo tee -a /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### C.5 Firewall
UFW ya debería permitir 22/80/443 (de CLINITURNO). Confirmar:
```bash
sudo ufw status | grep -E "22|80|443"
```

---

## FASE D — Verificación end-to-end (Gate BDD — no asumir, comprobar)

Ejecutar en el VPS y desde fuera:
```bash
pm2 status                                   # sismar-app = online (y cliniturno-app sigue online)
curl -sI http://127.0.0.1:3002 | head -1     # 200/307 desde loopback
curl -sI https://sismar.aisernet.tech | head -1   # 200 + TLS válido desde internet
sudo ss -tlnp | grep -E ':5433|:3002'        # deben estar SOLO en 127.0.0.1
```

**Escenario BDD mínimo (Given/When/Then):**
- **Given** el dominio `sismar.aisernet.tech` publicado con TLS,
- **When** abro `https://sismar.aisernet.tech` e inicio sesión con `admin` y la contraseña rotada,
- **Then** entro al panel de SISMAR y veo los módulos (correspondencia, planillas, admin).

**Checklist:**
- [ ] `https://sismar.aisernet.tech` abre con candado (certificado válido).
- [ ] Login `admin` con la contraseña rotada funciona (las claves por defecto del seed antiguo ya no existen — H-003).
- [ ] `fafos.aisernet.tech` **sigue funcionando** (no se rompió la convivencia).
- [ ] Postgres `:5433` y app `:3002` escuchan **solo** en `127.0.0.1`.

---

## FASE E — Redeploys futuros (flujo de trabajo continuo)
Cada vez que haya cambios nuevos:
```bash
# local:
git push origin main
# en el VPS:
cd ~/sismar && git pull origin main
npm install --no-audit --no-fund && npx prisma migrate deploy && npm run build
pm2 restart sismar-app
```
> **Nunca** re-ejecutar `npx tsx prisma/seed.ts` sobre la base ya poblada (ver RADAR).
> Tras cada `pm2 restart`, si un navegador ya tenía la app abierta, hacer **hard-reload**
> (Next no refresca una pestaña vieja automáticamente).

---

## RADAR del despliegue (Capa Guardian — riesgos vivos)

- 🔴 **Credenciales por defecto del seed antiguo** para `admin`, `mensajero`, `gerencia`, `talento` (CERRADO en H-003: seed sin claves fijas; rotación ejecutada)
  (definidas en `prisma/seed.ts`). En un entorno accesible por internet esto es crítico:
  **cambiar la contraseña de `admin` inmediatamente tras el primer login** y, mejor aún,
  rotar/eliminar los usuarios de prueba antes de exponer el dominio.
- 🟠 **`prisma/seed.ts` usa `.create` (no `upsert`)** → re-ejecutarlo sobre una base ya
  sembrada fallará por claves únicas o duplicará datos. Correr el seed **solo una vez**,
  en base vacía. Para ajustes puntuales de config, usar scripts quirúrgicos, no reseedear.
- 🟠 **Endpoints públicos sin allowlist / rate-limit.** Al ser pre-producción abierta a
  internet, valen los mismos abuse cases que en NextLine (bots, fuerza bruta al login).
  Registrar como deuda: rate-limit en el login y, si aplica, restricción por IP.
- 🟡 **`JWT_SECRET` debe ser fuerte y único** (se genera con `openssl rand -hex 64` en C.2).
  No reutilizar el de CLINITURNO ni el placeholder del `.env` de ejemplo.
- 🟡 **Backups de Postgres de SISMAR** (pg_dump programado del contenedor `sismar_postgres`)
  — no configurado. Replicar el patrón `deploy/backup-db.sh` + cron de CLINITURNO.
- 🟡 **Dos repos remotos** (`origin` AISerNet y `foscal` cliente): desplegar **siempre**
  desde `origin`. Definir con Mauricio la política de sincronización hacia `foscal`.
- 🟡 **Aislamiento de datos entre CLINITURNO y SISMAR:** son contenedores y volúmenes
  Postgres distintos (`sismar_postgres` / `sismar_pgdata`), en puertos distintos. Verificar
  en el Gate D que ninguno de los dos quedó escuchando en `0.0.0.0`.

---
*By AISerNet Company — metodología STRATA v3.*

---

## Actualización H-003 (remediación Auditoría N.º 2, oct/2026)

Pasos adicionales al actualizar el VPS a la versión con el Flujo H-003 (ver también
`docs/OPERACION.md`, runbook genérico sin secretos):

1. Añadir al `.env` del servidor (junto a `DATABASE_URL`/`JWT_SECRET`):
   ```
   ALLOWED_HOSTS="<dominio público de SISMAR>"
   UPLOADS_DIR="/ruta/privada/fuera/de/public"   # p. ej. $(pwd)/storage/uploads
   ```
2. `npx prisma migrate deploy` — aplica `20261001120000_h003_seguridad_autorizacion`
   (enums con `USING`, tablas `Sesion` y `AuditLog`, columnas de bloqueo y autoría). Si
   aborta, el mensaje lista los valores fuera de dominio a corregir; no se pierde nada.
3. `npx prisma generate && npx tsx prisma/sync-permissions.ts` — crea los permisos
   `planillas.gestionar` y `correspondencia.recibir` y sus asignaciones por defecto.
4. `npx tsx prisma/migrate-uploads.ts --dry-run` y luego sin `--dry-run` — mueve los
   archivos de `public/uploads` al directorio privado y reescribe las URLs en BD.
5. `npm run build && pm2 restart sismar-app`.
6. Verificar: `curl -I https://<dominio>/login` → `200` con `content-security-policy`
   que contenga `nonce-`; `curl -I https://<dominio>/uploads/x.pdf` → `404`;
   `curl -I "https://<dominio>/api/uploads?filename=x.pdf"` → `401`.
7. Avisar a los usuarios: todas las sesiones anteriores quedan invalidadas (deben
   iniciar sesión de nuevo). `deploy/setup-sismar.sh` ya incorpora los pasos 1–4 para
   aprovisionamientos nuevos (exige `SITE_DOMAIN`).
