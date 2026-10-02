import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * H-003 / C-008 — Guardian R-032, R-036(c), R-042(5).
 * Tests de COMPORTAMIENTO de loginAction con Prisma, cookies y sesión simulados.
 */
const db = vi.hoisted(() => ({
    usuario: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
}))
const cookieSet = vi.hoisted(() => vi.fn())
const sessions = vi.hoisted(() => ({ createSession: vi.fn(async () => ({ id: 'sid-1', expiresAt: new Date(Date.now() + 1000) })), revokeSession: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/session-store', () => sessions)
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: () => undefined, set: cookieSet }),
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.77', 'user-agent': 'vitest' }),
}))
vi.mock('next/navigation', () => ({
    redirect: vi.fn((u: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${u}`), { digest: `NEXT_REDIRECT;replace;${u}` }) }),
}))
vi.mock('bcryptjs', async () => {
    const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
    return { ...actual, compare: vi.fn(actual.compare), hash: vi.fn(actual.hash) }
})

import * as bcrypt from 'bcryptjs'
import { audit } from '@/lib/audit'
import { resetRateLimit } from '@/lib/rate-limit'
import { DUMMY_BCRYPT_HASH } from '@/lib/login-policy'

type UpdateArg = { data: { password?: string } }
const updateCalls = () => (db.usuario.update.mock.calls as unknown as Array<[UpdateArg]>).map(c => c[0])

function form(username: string, password: string) {
    const fd = new FormData(); fd.set('username', username); fd.set('password', password); return fd
}

// Hash de coste 10 (heredado del seed anterior) para "ClaveCorrecta1"
const HASH_COST10 = bcrypt.hashSync('ClaveCorrecta1', 10)

beforeEach(() => {
    resetRateLimit()
    db.usuario.findUnique.mockReset()
    db.usuario.update.mockClear()
    cookieSet.mockClear()
    sessions.createSession.mockClear()
    vi.mocked(bcrypt.compare).mockClear()
    vi.mocked(audit).mockClear()
})

describe('S-016: loginAction', () => {
    it('usuario inexistente → bcrypt de relleno, mensaje genérico y bitácora SIN el nombre tecleado en claro', async () => {
        db.usuario.findUnique.mockResolvedValue(null)
        const { loginAction } = await import('@/app/actions/auth')
        const res = await loginAction(form('posible-contraseña-tecleada-aqui', 'x'))
        expect(res?.error).toBe('Credenciales inválidas')
        expect(vi.mocked(bcrypt.compare)).toHaveBeenCalledWith('x', DUMMY_BCRYPT_HASH)
        expect(sessions.createSession).not.toHaveBeenCalled()
        const entry = vi.mocked(audit).mock.calls.find(c => c[0].accion === 'LOGIN_FALLIDO')?.[0]
        expect(entry).toBeDefined()
        expect(entry!.username).not.toBe('posible-contraseña-tecleada-aqui')
        expect(JSON.stringify(entry)).not.toContain('posible-contraseña-tecleada-aqui')
    })

    it('cuenta bloqueada → mismo mensaje genérico, sin sesión, bitácora LOGIN_BLOQUEADO', async () => {
        db.usuario.findUnique.mockResolvedValue({ id: 1, username: 'admin', password: HASH_COST10, role: 'ADMIN', agenciaId: null, failedLoginAttempts: 10, lockedUntil: new Date(Date.now() + 60_000) })
        const { loginAction } = await import('@/app/actions/auth')
        const res = await loginAction(form('admin', 'ClaveCorrecta1'))
        expect(res?.error).toBe('Credenciales inválidas')
        expect(sessions.createSession).not.toHaveBeenCalled()
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN_BLOQUEADO' }))
    })

    it('contraseña errónea → incrementa el contador persistente', async () => {
        db.usuario.findUnique.mockResolvedValue({ id: 1, username: 'admin', password: HASH_COST10, role: 'ADMIN', agenciaId: null, failedLoginAttempts: 2, lockedUntil: null })
        const { loginAction } = await import('@/app/actions/auth')
        const res = await loginAction(form('admin', 'incorrecta'))
        expect(res?.error).toBe('Credenciales inválidas')
        expect(db.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 3 }) }))
    })

    it('S-020/R-032: login correcto con hash heredado (coste 10) → se re-hashea a coste 12, crea sesión en BD y redirige', async () => {
        db.usuario.findUnique.mockResolvedValue({ id: 1, username: 'admin', password: HASH_COST10, role: 'ADMIN', agenciaId: null, failedLoginAttempts: 0, lockedUntil: null })
        const { loginAction } = await import('@/app/actions/auth')
        await expect(loginAction(form('admin', 'ClaveCorrecta1'))).rejects.toThrow('NEXT_REDIRECT:/')
        const rehash = updateCalls().find(c => typeof c.data.password === 'string')
        expect(rehash, 'debe re-hashear la contraseña').toBeDefined()
        expect(rehash!.data.password).toMatch(/^\$2[aby]\$12\$/)
        expect(sessions.createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, ip: '203.0.113.77' }))
        expect(cookieSet).toHaveBeenCalledWith('session', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }))
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN_OK' }))
    })

    it('login correcto con hash de coste 12 → no re-hashea', async () => {
        const hash12 = await bcrypt.hash('ClaveCorrecta1', 12)
        db.usuario.findUnique.mockResolvedValue({ id: 1, username: 'admin', password: hash12, role: 'ADMIN', agenciaId: null, failedLoginAttempts: 0, lockedUntil: null })
        const { loginAction } = await import('@/app/actions/auth')
        await expect(loginAction(form('admin', 'ClaveCorrecta1'))).rejects.toThrow('NEXT_REDIRECT:/')
        const rehash = updateCalls().find(c => typeof c.data.password === 'string')
        expect(rehash).toBeUndefined()
    })
})
