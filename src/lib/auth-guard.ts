import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Role } from '@prisma/client'
import { getSessionPayload } from './auth'
import { SESSION_COOKIE_NAME, SESSION_EXPIRED_PATH } from './session-cookie'
import { resolveSession } from './session-store'
import { hasPermission } from './permissions'
import { audit } from './audit'

/**
 * Guards centrales de autenticación/autorización (SEC-003 + H-003 / C-001, C-005, C-007).
 *
 * Fuente de verdad: la BASE DE DATOS en cada petición (sesión viva + usuario con
 * rol/agencia frescos). El JWT solo identifica la sesión. Un usuario degradado,
 * borrado o con logout server-side deja de servir en la siguiente petición.
 *
 * Contrato de denegación (Spec H-003 §6.4):
 *  - Sin sesión válida            → redirect('/login')  (páginas y acciones).
 *  - Sin permiso / objeto ajeno   → `ForbiddenError` (acciones la convierten en
 *    `{ error: '... (403)' }` con `handleActionError`; las páginas usan
 *    `requirePagePermission` y renderizan <AccessDenied/>).
 *  - Todo intento denegado se registra en AuditLog (ACCESO_DENEGADO).
 */

export interface AuthContext {
    userId: number
    username: string
    role: Role
    agenciaId: number | null
    sid: string
}

export class ForbiddenError extends Error {
    readonly status = 403
    constructor(message = 'No autorizado para esta operación (403)') {
        super(message)
        this.name = 'ForbiddenError'
    }
}

/**
 * Resuelve el contexto de autenticación SIN redirigir. Devuelve null si no hay
 * cookie, el JWT es inválido, la sesión fue revocada/expiró o el usuario no existe.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
    const payload = await getSessionPayload()
    if (!payload?.sid) return null
    const resolved = await resolveSession(payload.sid)
    if (!resolved) return null
    // Defensa en profundidad: el usuario de la sesión debe coincidir con el del token.
    if (typeof payload.userId === 'number' && payload.userId !== resolved.user.id) return null
    return {
        userId: resolved.user.id,
        username: resolved.user.username,
        role: resolved.user.role,
        agenciaId: resolved.user.agenciaId,
        sid: resolved.session.id,
    }
}

export async function requireSession(): Promise<AuthContext> {
    const ctx = await getAuthContext()
    if (!ctx) {
        // Si hay cookie pero la sesión ya no vale (revocada, expirada, usuario
        // borrado o token antiguo), hay que BORRARLA antes de ir al login; un
        // Server Component no puede hacerlo, así que delega en la ruta de salida.
        const hasCookie = !!(await cookies()).get(SESSION_COOKIE_NAME)?.value
        redirect(hasCookie ? SESSION_EXPIRED_PATH : '/login')
    }
    return ctx
}

/** ¿Tiene el usuario el permiso granular? (rol + overrides, leído de BD). */
export async function can(ctx: AuthContext, code: string): Promise<boolean> {
    return hasPermission(ctx.userId, ctx.role, code)
}

/** Exige un permiso sobre un contexto YA autenticado (útil cuando el permiso depende de datos del registro). */
export async function assertPermission(ctx: AuthContext, code: string): Promise<void> {
    if (await can(ctx, code)) return
    await audit({ ctx, accion: 'ACCESO_DENEGADO', detalle: { permiso: code } })
    throw new ForbiddenError(`No tiene el permiso requerido (${code}) (403)`)
}

export async function requirePermission(code: string): Promise<AuthContext> {
    const ctx = await requireSession()
    await assertPermission(ctx, code)
    return ctx
}

/**
 * Exige sesión válida CON rol ADMIN (leído de BD). Único guard para
 * administración: usuarios, permisos, configuración y TODOS los catálogos.
 */
export async function requireAdmin(): Promise<AuthContext> {
    const ctx = await requireSession()
    if (ctx.role !== 'ADMIN') {
        await audit({ ctx, accion: 'ACCESO_DENEGADO', detalle: { requerido: 'ADMIN' } })
        throw new ForbiddenError('Operación reservada al administrador (403)')
    }
    return ctx
}

export type PageAuth =
    | { ok: true; ctx: AuthContext }
    | { ok: false; ctx: AuthContext; permiso: string }

/**
 * Variante para páginas (Server Components): no lanza; devuelve `ok:false` para
 * que la página renderice <AccessDenied/> en lugar de redirigir en silencio.
 */
export async function requirePagePermission(code: string): Promise<PageAuth> {
    const ctx = await requireSession()
    const allowed = await can(ctx, code)
    if (!allowed) {
        await audit({ ctx, accion: 'ACCESO_DENEGADO', detalle: { permiso: code, via: 'pagina' } })
        return { ok: false, ctx, permiso: code }
    }
    return { ok: true, ctx }
}

export async function requireAdminPage(): Promise<PageAuth> {
    const ctx = await requireSession()
    if (ctx.role !== 'ADMIN') {
        await audit({ ctx, accion: 'ACCESO_DENEGADO', detalle: { requerido: 'ADMIN', via: 'pagina' } })
        return { ok: false, ctx, permiso: 'ADMIN' }
    }
    return { ok: true, ctx }
}

// ── Resultado homogéneo de server actions ────────────────────────────────────
// Un único tipo discriminado para que los componentes cliente puedan leer
// `result.error` / `result.success` sin castear.
export type ActionFailure = { success?: false; error: string }
export type ActionSuccess<T extends object = Record<never, never>> = { success: true; error?: undefined } & T
export type ActionResult<T extends object = Record<never, never>> = ActionSuccess<T> | ActionFailure

export function ok(): ActionSuccess
export function ok<T extends object>(data: T): ActionSuccess<T>
export function ok<T extends object>(data?: T): ActionSuccess<T> {
    return { success: true as const, ...(data ?? ({} as T)) } as ActionSuccess<T>
}

export function fail(error: string): ActionFailure {
    return { success: false, error }
}

/** Errores internos de Next (redirect, notFound, forbidden) que deben propagarse. */
export function isNextInternalError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false
    const digest = (e as { digest?: unknown }).digest
    return typeof digest === 'string' && digest.startsWith('NEXT_')
}

/**
 * Manejo homogéneo de errores en server actions:
 *  - Re-lanza redirecciones/notFound de Next.
 *  - ForbiddenError → `{ error }` explícito (403), nunca redirección silenciosa.
 *  - Otros → log del mensaje (sin stack, SEC-015) y mensaje genérico.
 */
export function handleActionError(e: unknown, fallbackMessage: string): ActionFailure {
    if (isNextInternalError(e)) throw e
    if (e instanceof ForbiddenError) return fail(e.message)
    console.error(`${fallbackMessage}:`, e instanceof Error ? e.message : String(e))
    return fail(fallbackMessage)
}
