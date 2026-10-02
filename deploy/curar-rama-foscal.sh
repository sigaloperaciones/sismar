#!/usr/bin/env bash
set -euo pipefail
# =============================================================================
# Construye la rama CURADA para el repositorio del cliente (Clínica FOSCAL).
#
#   deploy/curar-rama-foscal.sh <rama-destino> <rama-base> <commit-fuente>
#   p. ej.: deploy/curar-rama-foscal.sh foscal-sync-3 foscal-sync-2 fix/remediacion-auditoria-2
#
# Qué hace (en un worktree temporal, sin tocar la rama actual):
#   1. Crea <rama-destino> desde <rama-base> (lo último que recibió el cliente).
#   2. Copia el árbol COMPLETO de <commit-fuente>.
#   3. EXCLUYE todo lo que revela infraestructura interna o la relación comercial
#      AISerNet/SIGAL (ver EXCLUIR).
#   4. Aplica la MARCA del canal comercial del cliente (SIGAL Group) a la
#      documentación, manuales (.md y .docx) y al crédito de la pantalla de acceso.
#   5. Verifica: sin menciones a AISerNet ni a datos de infraestructura, tests y tsc en verde.
#   6. Crea UN commit curado. NO hace push: el push a `foscal` lo decide Mauricio
#      (actualmente condicionado a R-029).
#
# Este script vive en deploy/, carpeta que la rama curada NO incluye.
# =============================================================================
DEST="${1:?rama destino (p. ej. foscal-sync-3)}"
BASE="${2:?rama base (p. ej. foscal-sync-2 o foscal/main)}"
SRC="${3:?commit o rama fuente (p. ej. fix/remediacion-auditoria-2)}"
MSG="${4:-fix(seguridad): remediación Auditoría N.º 2 — autorización en el núcleo (SIGAL Group · Equipo ASIA)}"

ROOT="$(git rev-parse --show-toplevel)"
WT="$(mktemp -d "${TMPDIR:-/tmp}/sismar-curado.XXXXXX")"
trap 'git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT

echo "== 1) worktree $WT con rama $DEST desde $BASE"
git -C "$ROOT" branch -f "$DEST" "$BASE"
git -C "$ROOT" worktree add --quiet "$WT" "$DEST"
cd "$WT"

echo "== 2) árbol de $SRC"
git read-tree -u --reset "$(git -C "$ROOT" rev-parse "$SRC")"

echo "== 3) exclusiones"
EXCLUIR=(
  deploy
  docker-compose.prod.yml
  docs/DEPLOY_VPS_HOSTINGER_SISMAR.md
  docs/auditoria/RESPUESTA_AUDITORIA_SISMAR.md
  docs/auditoria/RESPUESTA_AUDITORIA_2_SISMAR.md
  docs/auditoria/Informe_Remediacion_SISMAR_ASIA.pdf
  docs/auditoria/Informe_Remediacion_Auditoria2_SISMAR_ASIA.docx
  docs/auditoria/Informe_Remediacion_Auditoria2_SISMAR_ASIA.pdf
  docs/auditoria/fuente
  docs/manuales/fuente/herramientas
  artefacts
  .claude
  publicar.bat
)
for p in "${EXCLUIR[@]}"; do
  if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then git rm -r -q -f -- "$p"; echo "   - $p"; fi
done

echo "== 4) marca del canal comercial (SIGAL Group)"
# Documentos de texto: sustitución directa (de más específico a más general).
MARCA_MD=( README.md .env.example docs/OPERACION.md specs/H-003-remediacion-auditoria-2/spec.md "src/app/(auth)/login/page.tsx" src/app/globals.css )
while IFS= read -r f; do MARCA_MD+=("$f"); done < <(git ls-files 'docs/manuales/fuente/*.md')
for f in "${MARCA_MD[@]}"; do
  [ -f "$f" ] || continue
  python - "$f" <<'PY'
import io, sys
p = sys.argv[1]; s = io.open(p, encoding="utf-8").read(); o = s
s = s.replace("By AISerNet Company", "By SIGAL Group").replace("AISerNet Company", "SIGAL Group").replace("AISerNet", "SIGAL Group")
if s != o:
    io.open(p, "w", encoding="utf-8", newline="\n").write(s); print("   ~", p)
PY
done
# Manuales .docx: misma sustitución dentro del XML (los generó docx-js con runs contiguos).
for f in docs/manuales/*.docx; do
  python - "$f" <<'PY'
import sys, zipfile, os
src = sys.argv[1]; tmp = src + ".tmp"; n = 0
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename.endswith(".xml"):
            s = data.decode("utf-8"); o = s
            s = s.replace("By AISerNet Company", "By SIGAL Group").replace("AISerNet Company", "SIGAL Group").replace("AISerNet", "SIGAL Group")
            if s != o: n += s.count("SIGAL Group") - o.count("SIGAL Group"); data = s.encode("utf-8")
        zout.writestr(item, data)
os.replace(tmp, src); print(f"   ~ {src} ({n} sustituciones)")
PY
done
git add -A

echo "== 5) verificación"
if git grep -I -n -i -E "aisernet|177\.7\.|CLINITURNO|fafos|hostinger|srv1632792|sigaloperaciones" -- . ':!package-lock.json' ; then
  echo "ERROR: quedan menciones internas en la rama curada"; exit 1
fi
echo "   sin menciones internas"
for p in "${EXCLUIR[@]}"; do git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 && { echo "ERROR: $p sigue presente"; exit 1; }; done
echo "   exclusiones aplicadas"
# node_modules del repositorio principal: en Windows (Git Bash) se usa una unión de
# directorios (mklink /J) porque `ln -s` copiaría la carpeta; se elimina solo la unión.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    WT_NM="$(cygpath -w "$WT/node_modules")"; ROOT_NM="$(cygpath -w "$ROOT/node_modules")"
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$WT_NM" "$ROOT_NM" >/dev/null
    QUITAR_NM="MSYS_NO_PATHCONV=1 cmd /c rmdir \"$WT_NM\"" ;;
  *)
    ln -s "$ROOT/node_modules" node_modules
    QUITAR_NM='rm -f node_modules' ;;
esac
npx tsc --noEmit >/dev/null && echo "   tsc: sin errores"
npx vitest run 2>&1 | grep -E "Test Files|Tests " | sed 's/^/   /'
eval "$QUITAR_NM" 

echo "== 6) commit curado"
git commit -q -m "$MSG" -m "Rama curada para el cliente: incluye código, migraciones, pruebas, especificaciones STRATA, manuales e informe (SIGAL Group · Equipo ASIA). Excluye configuración de infraestructura y documentación interna." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git log --oneline -1
git diff --stat "$BASE" "$DEST" | tail -1
echo "Listo: rama $DEST creada. NO se ha hecho push."
