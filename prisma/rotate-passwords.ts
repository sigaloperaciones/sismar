/**
 * Script de rotación de contraseñas de usuarios semilla.
 * (Remediación operativa — Auditoría FOSCAL; H-003 / C-001: además REVOCA las
 * sesiones activas del usuario y reinicia su bloqueo de cuenta.)
 *
 * USO:
 *   npx tsx prisma/rotate-passwords.ts                  # rota admin, mensajero, gerencia, talento
 *   npx tsx prisma/rotate-passwords.ts admin gerencia   # rota solo los indicados
 *
 * IMPORTANTE:
 *   - Las nuevas contraseñas se imprimen UNA sola vez en pantalla. Guárdalas en un
 *     gestor seguro; NO se escriben a ningún archivo ni se registran en logs.
 *   - Solo actualiza usuarios que YA existen (no crea usuarios).
 *   - Usa bcrypt con coste 12 (igual que el alta de usuarios de la app).
 */
import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"
import { generateStrongPassword } from "../src/lib/password"

const prisma = new PrismaClient()

const DEFAULT_USERS = ["admin", "mensajero", "gerencia", "talento"]

async function main() {
    const args = process.argv.slice(2).filter(a => !a.startsWith("-"))
    const targets = args.length > 0 ? args : DEFAULT_USERS

    console.log(`\n== Rotación de contraseñas (${targets.length} usuario(s)) ==\n`)

    const resultados: Array<{ usuario: string; nueva: string; sesiones: number }> = []

    for (const username of targets) {
        const user = await prisma.usuario.findUnique({ where: { username } })
        if (!user) {
            console.warn(`  ⚠  '${username}' no existe — se omite.`)
            continue
        }
        const nueva = generateStrongPassword(16)
        const hash = await bcrypt.hash(nueva, 12)
        const now = new Date()
        const [, revocadas] = await prisma.$transaction([
            prisma.usuario.update({
                where: { id: user.id },
                data: { password: hash, failedLoginAttempts: 0, lockedUntil: null },
            }),
            prisma.sesion.updateMany({ where: { usuarioId: user.id, revokedAt: null }, data: { revokedAt: now } }),
            prisma.auditLog.create({
                data: { usuarioId: user.id, username: user.username, accion: "SESIONES_REVOCADAS", entidad: "Usuario", entidadId: String(user.id), detalle: { motivo: "rotacion de contraseña (script)" } },
            }),
        ])
        resultados.push({ usuario: username, nueva, sesiones: revocadas.count })
    }

    if (resultados.length === 0) {
        console.log("No se rotó ninguna contraseña.")
        return
    }

    console.log("  Guarda estas credenciales AHORA (no se volverán a mostrar):\n")
    console.log("  ┌───────────────┬──────────────────────┬──────────┐")
    console.log("  │ USUARIO       │ NUEVA CONTRASEÑA     │ SESIONES │")
    console.log("  ├───────────────┼──────────────────────┼──────────┤")
    for (const r of resultados) {
        console.log(`  │ ${r.usuario.padEnd(13)} │ ${r.nueva.padEnd(20)} │ ${String(r.sesiones).padStart(8)} │`)
    }
    console.log("  └───────────────┴──────────────────────┴──────────┘\n")
    console.log(`  ✅ ${resultados.length} contraseña(s) rotada(s); sesiones activas revocadas.\n`)
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error("Error en la rotación:", e instanceof Error ? e.message : String(e))
        await prisma.$disconnect()
        process.exit(1)
    })
