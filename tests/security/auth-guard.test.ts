import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SEC-003 (FOSCAL) + H-003 / C-001 — Guard central de autenticación.
 * requireSession(): sin cookie, con JWT corrupto o con sesión no viva en BD
 * redirige a /login; con sesión viva devuelve el contexto FRESCO de BD.
 */
const cookieStore = new Map<string, { value: string }>()
const store = vi.hoisted(() => ({ resolved: null as null | Record<string, unknown> }))

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => cookieStore.get(name),
        set: (name: string, value: string) => cookieStore.set(name, { value }),
    }),
    headers: async () => new Headers(),
}))

const redirectMock = vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url}` })
})
vi.mock('next/navigation', () => ({
    redirect: (url: string) => redirectMock(url),
}))

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))
vi.mock('@/lib/session-store', () => ({ resolveSession: async () => store.resolved }))

describe('SEC-003 / C-001: requireSession', () => {
    beforeEach(() => {
        cookieStore.clear()
        redirectMock.mockClear()
        store.resolved = null
    })

    it('sin cookie de sesión → redirige a /login', async () => {
        const { requireSession } = await import('@/lib/auth-guard')
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/login')
        expect(redirectMock).toHaveBeenCalledWith('/login')
    })

    it('con cookie inválida (JWT corrupto) → redirige a la ruta que borra la cookie', async () => {
        cookieStore.set('session', { value: 'no-es-un-jwt' })
        const { requireSession } = await import('@/lib/auth-guard')
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/api/auth/expired')
    })

    it('JWT válido pero sesión no viva en BD → redirige a /api/auth/expired (revocación efectiva, sin bucle)', async () => {
        const { encrypt } = await import('@/lib/auth')
        cookieStore.set('session', { value: await encrypt({ sid: 's1', userId: 1, username: 'admin', role: 'ADMIN' }) })
        store.resolved = null
        const { requireSession } = await import('@/lib/auth-guard')
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/api/auth/expired')
    })

    it('con sesión viva → retorna el contexto fresco de BD', async () => {
        const { encrypt } = await import('@/lib/auth')
        cookieStore.set('session', { value: await encrypt({ sid: 's1', userId: 1, username: 'admin', role: 'ADMIN' }) })
        store.resolved = {
            session: { id: 's1', usuarioId: 1, expiresAt: new Date(Date.now() + 60_000) },
            user: { id: 1, username: 'admin', role: 'ADMIN', agenciaId: null },
        }
        const { requireSession } = await import('@/lib/auth-guard')
        const ctx = await requireSession()
        expect(ctx.username).toBe('admin')
        expect(ctx.sid).toBe('s1')
        expect(redirectMock).not.toHaveBeenCalled()
    })

    it('requireAdmin con rol no ADMIN → ForbiddenError (403), no redirección', async () => {
        const { encrypt } = await import('@/lib/auth')
        cookieStore.set('session', { value: await encrypt({ sid: 's1', userId: 3, username: 'gerencia', role: 'AGENCIA' }) })
        store.resolved = {
            session: { id: 's1', usuarioId: 3, expiresAt: new Date(Date.now() + 60_000) },
            user: { id: 3, username: 'gerencia', role: 'AGENCIA', agenciaId: 1 },
        }
        const { requireAdmin, ForbiddenError } = await import('@/lib/auth-guard')
        await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError)
        expect(redirectMock).not.toHaveBeenCalled()
    })

    it('handleActionError: re-lanza redirecciones de Next y convierte Forbidden en { error }', async () => {
        const { handleActionError, ForbiddenError } = await import('@/lib/auth-guard')
        expect(() => handleActionError(Object.assign(new Error('r'), { digest: 'NEXT_REDIRECT;replace;/login' }), 'x')).toThrow()
        expect(handleActionError(new ForbiddenError(), 'x')).toEqual({ success: false, error: 'No autorizado para esta operación (403)' })
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(handleActionError(new Error('stack interno'), 'Error al guardar')).toEqual({ success: false, error: 'Error al guardar' })
        spy.mockRestore()
    })
})
