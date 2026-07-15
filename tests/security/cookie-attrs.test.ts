import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * SEC-008 (Auditoría FOSCAL) — Cookie de sesión con atributos seguros
 * en TODAS las operaciones (refresh en updateSession y clear en logout).
 */

const cookieSetCalls: Array<Record<string, unknown>> = []
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => undefined,
        set: (...args: unknown[]) => {
            if (typeof args[0] === 'string') {
                cookieSetCalls.push({ name: args[0], value: args[1], ...(args[2] as object) })
            } else {
                cookieSetCalls.push(args[0] as Record<string, unknown>)
            }
        },
    }),
}))

describe('SEC-008: atributos de cookie de sesión', () => {
    it('updateSession refresca la cookie con httpOnly + sameSite lax + path /', async () => {
        const { encrypt, updateSession } = await import('@/lib/auth')
        const token = await encrypt({ userId: 1, username: 'admin', role: 'ADMIN' })
        const req = new NextRequest('http://localhost/', {
            headers: { cookie: `session=${token}` },
        })
        const res = await updateSession(req)
        expect(res).toBeDefined()
        const cookie = res!.cookies.get('session')
        expect(cookie).toBeDefined()
        expect(cookie!.httpOnly).toBe(true)
        expect(cookie!.sameSite).toBe('lax')
        expect(cookie!.path).toBe('/')
    })

    it('logout limpia la cookie con los mismos atributos de seguridad', async () => {
        cookieSetCalls.length = 0
        const { logout } = await import('@/lib/auth')
        await logout()
        const call = cookieSetCalls.find(c => c.name === 'session')
        expect(call).toBeDefined()
        expect(call!.httpOnly).toBe(true)
        expect(call!.sameSite).toBe('lax')
        expect(call!.path).toBe('/')
    })
})
