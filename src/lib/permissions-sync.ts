import type { PrismaClient, Role } from '@prisma/client'
import { PERMISOS_CATALOGO, ROL_PERMISOS_DEFAULT, type RolNombre } from './permissions-catalog'

/**
 * Sincronización IDEMPOTENTE del catálogo de permisos (H-003 / C-012, C-004).
 *
 * - Crea/actualiza cada `Permiso` del catálogo (nombre, módulo, descripción).
 * - Crea los `RolPermiso` por defecto que FALTEN. Nunca sobrescribe una fila
 *   existente: las decisiones del administrador en la matriz se respetan.
 * - Jamás borra nada.
 *
 * Lo usan el seed y `prisma/sync-permissions.ts` (para bases ya desplegadas
 * tras añadir permisos nuevos).
 */
export async function syncPermissions(prisma: PrismaClient): Promise<{ permisos: number; rolPermisosCreados: number }> {
    let rolPermisosCreados = 0

    for (const def of PERMISOS_CATALOGO) {
        await prisma.permiso.upsert({
            where: { codigo: def.codigo },
            create: { codigo: def.codigo, nombre: def.nombre, modulo: def.modulo, descripcion: def.descripcion ?? null },
            update: { nombre: def.nombre, modulo: def.modulo, descripcion: def.descripcion ?? null },
        })
    }

    const permisos = await prisma.permiso.findMany({ select: { id: true, codigo: true } })
    const idPorCodigo = new Map(permisos.map(p => [p.codigo, p.id]))

    for (const rol of Object.keys(ROL_PERMISOS_DEFAULT) as RolNombre[]) {
        for (const codigo of ROL_PERMISOS_DEFAULT[rol]) {
            const permisoId = idPorCodigo.get(codigo)
            if (!permisoId) continue
            const existing = await prisma.rolPermiso.findUnique({
                where: { rol_permisoId: { rol: rol as Role, permisoId } },
            })
            if (!existing) {
                await prisma.rolPermiso.create({ data: { rol: rol as Role, permisoId, concedido: true } })
                rolPermisosCreados++
            }
        }
    }

    return { permisos: permisos.length, rolPermisosCreados }
}
