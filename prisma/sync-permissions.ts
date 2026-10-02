/**
 * Sincroniza el catálogo de permisos en una base YA DESPLEGADA (H-003 / C-004).
 *
 * Necesario tras añadir permisos nuevos (`planillas.gestionar`,
 * `correspondencia.recibir`): `hasPermission` deniega por defecto si el código
 * no existe en la tabla `Permiso`. Idempotente y no destructivo: crea lo que
 * falta y respeta las decisiones del administrador en la matriz.
 *
 * Uso (en el servidor, tras `prisma migrate deploy`):
 *   npx tsx prisma/sync-permissions.ts
 */
import { PrismaClient } from '@prisma/client'
import { syncPermissions } from '../src/lib/permissions-sync'

const prisma = new PrismaClient()

syncPermissions(prisma)
    .then(async r => {
        console.log(`✅ Permisos sincronizados: ${r.permisos} permisos en catálogo, ${r.rolPermisosCreados} asignaciones de rol creadas.`)
        await prisma.$disconnect()
    })
    .catch(async e => {
        console.error('Error sincronizando permisos:', e instanceof Error ? e.message : String(e))
        await prisma.$disconnect()
        process.exit(1)
    })
