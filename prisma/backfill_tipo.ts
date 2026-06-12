/**
 * Backfill script: asigna el campo `tipo` a registros existentes de Correspondencia.
 * Ejecutar con: npx tsx prisma/backfill_tipo.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Los registros salientes tienen empresaMensajeria = "SALIENTE" (workaround anterior)
    const salientes = await prisma.correspondencia.updateMany({
        where: { empresaMensajeria: 'SALIENTE' },
        data: { tipo: 'SALIENTE', empresaMensajeria: null },
    })
    console.log(`✅ ${salientes.count} correspondencias marcadas como SALIENTE`)

    // El resto son entrantes (ya tienen el default "ENTRANTE")
    const entrantes = await prisma.correspondencia.count({ where: { tipo: 'ENTRANTE' } })
    console.log(`✅ ${entrantes} correspondencias ya marcadas como ENTRANTE`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
