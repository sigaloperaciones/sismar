import { prisma } from './prisma'

/**
 * Resuelve si un usuario tiene un permiso específico.
 * Prioridad: override de usuario > permiso por defecto del rol.
 * Si no existe fila en UsuarioPermiso → hereda del rol.
 */
export async function hasPermission(
    userId: number,
    userRole: string,
    permissionCode: string
): Promise<boolean> {
    const permiso = await prisma.permiso.findUnique({ where: { codigo: permissionCode } })
    if (!permiso) return false

    // Buscar override del usuario
    const userOverride = await prisma.usuarioPermiso.findUnique({
        where: { usuarioId_permisoId: { usuarioId: userId, permisoId: permiso.id } },
    })

    if (userOverride !== null) return userOverride.concedido

    // Fallback al permiso del rol
    const rolPermiso = await prisma.rolPermiso.findUnique({
        where: { rol_permisoId: { rol: userRole, permisoId: permiso.id } },
    })

    return rolPermiso?.concedido ?? false
}

/**
 * Carga todos los permisos efectivos de un usuario como Set<string> de códigos.
 * Eficiente: una sola consulta por tabla.
 */
export async function getUserPermissions(userId: number, userRole: string): Promise<Set<string>> {
    const [rolePermisos, userOverrides] = await Promise.all([
        prisma.rolPermiso.findMany({
            where: { rol: userRole, concedido: true },
            include: { permiso: true },
        }),
        prisma.usuarioPermiso.findMany({
            where: { usuarioId: userId },
            include: { permiso: true },
        }),
    ])

    const granted = new Set(rolePermisos.map(rp => rp.permiso.codigo))

    for (const override of userOverrides) {
        if (override.concedido) {
            granted.add(override.permiso.codigo)
        } else {
            granted.delete(override.permiso.codigo)
        }
    }

    return granted
}
