/**
 * Script de rotación de contraseñas de usuarios semilla.
 * (Remediación operativa — Auditoría FOSCAL: los usuarios seed venían con `123456`.)
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

    const resultados: Array<{ usuario: string; nueva: string }> = []

    for (const username of targets) {
        const user = await prisma.usuario.findUnique({ where: { username } })
        if (!user) {
            console.warn(`  ⚠  '${username}' no existe — se omite.`)
            continue
        }
        const nueva = generateStrongPassword(16)
        const hash = await bcrypt.hash(nueva, 12)
        await prisma.usuario.update({ where: { id: user.id }, data: { password: hash } })
        resultados.push({ usuario: username, nueva })
    }

    if (resultados.length === 0) {
        console.log("No se rotó ninguna contraseña.")
        return
    }

    console.log("  Guarda estas credenciales AHORA (no se volverán a mostrar):\n")
    console.log("  ┌───────────────┬──────────────────────┐")
    console.log("  │ USUARIO       │ NUEVA CONTRASEÑA     │")
    console.log("  ├───────────────┼──────────────────────┤")
    for (const r of resultados) {
        console.log(`  │ ${r.usuario.padEnd(13)} │ ${r.nueva.padEnd(20)} │`)
    }
    console.log("  └───────────────┴──────────────────────┘\n")
    console.log(`  ✅ ${resultados.length} contraseña(s) rotada(s) correctamente.\n`)
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error("Error en la rotación:", e instanceof Error ? e.message : String(e))
        await prisma.$disconnect()
        process.exit(1)
    })
