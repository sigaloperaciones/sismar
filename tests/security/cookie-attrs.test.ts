import { describe, it, expect, vi } from 'vitest'

/**
 * SEC-008 (FOSCAL) + B-01 (Auditoría 2) — Cookie de sesión con atributos seguros
 * en TODAS las operaciones. Ya no existe renovación rolling en el middleware
 * (C-001); las operaciones son: set (login), clear (logout, middleware).
 */
const cookieSetCalls: Array<Record<string, unknown>> = []
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => ({ value: 'tok' }),
        set: (...args: unknown[]) => {
            if (typeof args[0] === 'string') {
                cookieSetCalls.push({ name: args[0], value: args[1], ...(args[2] as object) })
            } else {
                cookieSetCalls.push(args[0] as Record<string, unknown>)
            }
        },
    }),
    headers: async () => new Headers(),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn((u: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${u}`), { digest: 'NEXT_REDIRECT' }) }) }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/session-store', () => ({ revokeSession: vi.fn(async () => {}), createSession: vi.fn() }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))
vi.mock('@/lib/auth', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return { ...actual, getSessionPayload: async () => ({ sid: 's1', userId: 1, username: 'admin', role: 'ADMIN' }) }
})

import { SESSION_COOKIE_OPTIONS, SESSION_COOKIE_CLEAR_OPTIONS } from '@/lib/session-cookie'
import { revokeSession } from '@/lib/session-store'

describe('SEC-008 / B-01: atributos de cookie de sesión', () => {
    it('las opciones únicas incluyen httpOnly + sameSite lax + path / (y secure en producción)', () => {
        expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true)
        expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax')
        expect(SESSION_COOKIE_OPTIONS.path).toBe('/')
        expect(SESSION_COOKIE_CLEAR_OPTIONS.expires.getTime()).toBe(0)
        expect(SESSION_COOKIE_CLEAR_OPTIONS.path).toBe('/')
    })

    it('S-002: logoutAction revoca la sesión en servidor y limpia la cookie con los mismos atributos', async () => {
        cookieSetCalls.length = 0
        const { logoutAction } = await import('@/app/actions/auth')
        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/login')
        expect(vi.mocked(revokeSession)).toHaveBeenCalledWith('s1')
        const call = cookieSetCalls.find(c => c.name === 'session')
        expect(call).toBeDefined()
        expect(call!.value).toBe('')
        expect(call!.httpOnly).toBe(true)
        expect(call!.sameSite).toBe('lax')
        expect(call!.path).toBe('/')
    })

    it('ya no existe renovación rolling (updateSession) en lib/auth', async () => {
        const auth = await import('@/lib/auth')
        expect('updateSession' in auth).toBe(false)
    })
})
