import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * H-003 / C-001 (hallazgo A-05) — Sesión revocable y contexto fresco.
 *  - resolveSession: null si revocada, expirada o inexistente.
 *  - getAuthContext: rol/agencia salen del USUARIO en BD, no del JWT.
 *  - requireSession redirige a /login cuando la sesión ya no sirve.
 */
const db = vi.hoisted(() => ({
    sesion: { findUnique: vi.fn(), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async () => ({})), deleteMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))

const cookieStore = new Map<string, { value: string }>()
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: (n: string) => cookieStore.get(n), set: vi.fn() }),
    headers: async () => new Headers(),
}))
const redirectMock = vi.fn((url: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url}` }) })
vi.mock('next/navigation', () => ({ redirect: (u: string) => redirectMock(u) }))

import { resolveSession, revokeSession, revokeAllSessions } from '@/lib/session-store'
import { encrypt } from '@/lib/auth'
import { getAuthContext, requireSession } from '@/lib/auth-guard'

const future = new Date(Date.now() + 60 * 60 * 1000)
const past = new Date(Date.now() - 1000)
const usuario = { id: 1, username: 'gerencia', role: 'AGENCIA', agenciaId: 1 }

beforeEach(() => {
    cookieStore.clear()
    db.sesion.findUnique.mockReset()
    db.sesion.update.mockClear()
    redirectMock.mockClear()
})

describe('resolveSession', () => {
    it('sesión viva → devuelve usuario fresco', async () => {
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: future, revokedAt: null, lastSeenAt: new Date(), usuario })
        const r = await resolveSession('s1')
        expect(r?.user).toEqual(usuario)
    })
    it('S-002: sesión revocada → null', async () => {
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: future, revokedAt: new Date(), lastSeenAt: new Date(), usuario })
        expect(await resolveSession('s1')).toBeNull()
    })
    it('sesión expirada → null (expiración absoluta, sin rolling)', async () => {
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: past, revokedAt: null, lastSeenAt: new Date(), usuario })
        expect(await resolveSession('s1')).toBeNull()
    })
    it('S-003: sesión inexistente (usuario borrado → cascade) → null', async () => {
        db.sesion.findUnique.mockResolvedValue(null)
        expect(await resolveSession('s1')).toBeNull()
        expect(await resolveSession('')).toBeNull()
    })
    it('revokeSession / revokeAllSessions marcan revokedAt', async () => {
        await revokeSession('s1')
        expect(db.sesion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', revokedAt: null } }))
        const n = await revokeAllSessions(1)
        expect(n).toBe(1)
    })
})

describe('getAuthContext / requireSession', () => {
    it('S-001: el rol viene de la BD aunque el JWT diga otra cosa', async () => {
        const token = await encrypt({ sid: 's1', userId: 1, username: 'gerencia', role: 'ADMIN', agenciaId: 99 })
        cookieStore.set('session', { value: token })
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: future, revokedAt: null, lastSeenAt: new Date(), usuario })
        const ctx = await getAuthContext()
        expect(ctx?.role).toBe('AGENCIA')
        expect(ctx?.agenciaId).toBe(1)
    })
    it('JWT válido pero sesión revocada → requireSession redirige a /api/auth/expired (borra cookie) ', async () => {
        const token = await encrypt({ sid: 's1', userId: 1, username: 'gerencia', role: 'AGENCIA' })
        cookieStore.set('session', { value: token })
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: future, revokedAt: new Date(), lastSeenAt: new Date(), usuario })
        await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/api/auth/expired')
    })
    it('JWT sin sid (formato antiguo) → sin contexto', async () => {
        const token = await encrypt({ userId: 1, username: 'x', role: 'ADMIN' } as never)
        cookieStore.set('session', { value: token })
        expect(await getAuthContext()).toBeNull()
    })
    it('userId del JWT distinto al de la sesión → sin contexto', async () => {
        const token = await encrypt({ sid: 's1', userId: 42, username: 'x', role: 'ADMIN' })
        cookieStore.set('session', { value: token })
        db.sesion.findUnique.mockResolvedValue({ id: 's1', usuarioId: 1, expiresAt: future, revokedAt: null, lastSeenAt: new Date(), usuario })
        expect(await getAuthContext()).toBeNull()
    })
})
