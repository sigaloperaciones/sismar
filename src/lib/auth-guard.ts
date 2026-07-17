import { redirect } from 'next/navigation'
import { getSession } from './auth'
import { hasPermission } from './permissions'

/**
 * Guards centrales de autenticación/autorización para server actions y API routes.
 * (Remediación SEC-003 — Auditoría FOSCAL jul/2026.)
 *
 * Toda server action de negocio DEBE iniciar con uno de estos guards:
 *  - requireSession(): exige sesión válida (JWT en cookie).
 *  - requirePermission(code): exige sesión + permiso granular (sistema Permiso/RolPermiso).
 */

export async function requireSession() {
    const session = await getSession()
    if (!session) redirect('/login')
    return session
}

export async function requirePermission(code: string) {
    const session = await requireSession()
    const allowed = await hasPermission(
        session.userId as number,
        session.role as string,
        code
    )
    if (!allowed) redirect('/')
    return session
}

/**
 * Exige sesión válida CON rol ADMIN. Para acciones de administración
 * (parametrización, usuarios, permisos). El layout /admin ya protege la UI,
 * pero las server actions son invocables directamente: la protección debe
 * repetirse en la acción.
 */
export async function requireAdmin() {
    const session = await requireSession()
    if (session.role !== 'ADMIN') redirect('/')
    return session
}
