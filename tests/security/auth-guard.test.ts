import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SEC-003 (Auditoría FOSCAL) — Guard central de autenticación para server actions.
 * requireSession(): sin sesión válida redirige a /login; con sesión la retorna.
 */

const cookieStore = new Map<string, { value: string }>()

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => cookieStore.get(name),
        set: (name: string, value: string) => cookieStore.set(name, { value }),
    }),
}))

const redirectMock = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
    redirect: (url: string) => redirectMock(url),
}))

// Unit test: no debe requerir el cliente Prisma real (lo importa la cadena
// auth-guard → permissions → prisma).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('SEC-003: requireSession', () => {
    beforeEach(() => {
        cookieStore.clear()
        redirectMock.mockClear()
    })

    it('sin cookie de sesión → redirige a /login', async () => {
        const { requireSession } = await import('@/lib/auth-guard')
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/login')
        expect(redirectMock).toHaveBeenCalledWith('/login')
    })

    it('con cookie inválida (JWT corrupto) → redirige a /login', async () => {
        cookieStore.set('session', { value: 'no-es-un-jwt' })
        const { requireSession } = await import('@/lib/auth-guard')
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/login')
    })

    it('con sesión válida → retorna el payload', async () => {
        const { encrypt } = await import('@/lib/auth')
        const token = await encrypt({ userId: 1, username: 'admin', role: 'ADMIN' })
        cookieStore.set('session', { value: token })

        const { requireSession } = await import('@/lib/auth-guard')
        const session = await requireSession()
        expect(session.username).toBe('admin')
        expect(redirectMock).not.toHaveBeenCalled()
    })
})
