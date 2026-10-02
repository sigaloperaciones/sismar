import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * H-003 / C-001, C-015 — Guardian R-036(d) (AC-006).
 * updateUserAction revoca TODAS las sesiones del usuario al cambiar rol, agencia
 * o contraseña; no lo hace por un cambio inocuo (correo).
 */
const state = { user: null as null | { id: number; username: string; role: string; agenciaId: number | null } }
const db = vi.hoisted(() => ({
    usuario: { findUnique: vi.fn(), update: vi.fn(async () => ({})), create: vi.fn(async () => ({ id: 9 })) },
    agencia: { findUnique: vi.fn(async () => ({ id: 2 })) },
}))
const sessions = vi.hoisted(() => ({ revokeAllSessions: vi.fn(async () => 2) }))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/session-store', () => ({
    ...sessions,
    resolveSession: async () => (state.user ? { session: { id: 's', usuarioId: state.user.id, expiresAt: new Date(Date.now() + 1000) }, user: state.user } : null),
}))
vi.mock('@/lib/auth', () => ({ getSessionPayload: async () => (state.user ? { sid: 's', userId: state.user.id } : null) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 't' }) }), headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn((u: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${u}`), { digest: 'NEXT_REDIRECT' }) }) }))

const ADMIN = { id: 1, username: 'admin', role: 'ADMIN', agenciaId: null }
const TALENTO = { id: 4, username: 'talento', email: null, password: 'hash', role: 'AGENCIA', agenciaId: 2, failedLoginAttempts: 0, lockedUntil: null }

function form(data: Record<string, string>) {
    const fd = new FormData(); for (const [k, v] of Object.entries(data)) fd.set(k, v); return fd
}

beforeEach(() => {
    state.user = ADMIN
    db.usuario.findUnique.mockReset()
    db.usuario.update.mockClear()
    sessions.revokeAllSessions.mockClear()
})

describe('AC-006: updateUserAction y revocación de sesiones', () => {
    it('cambio de rol → revoca todas las sesiones del usuario', async () => {
        db.usuario.findUnique.mockImplementation(async (args: { where: { id?: number; username?: string } }) =>
            args.where.id === 4 ? TALENTO : null)
        const { updateUserAction } = await import('@/app/actions/admin')
        const res = await updateUserAction(4, form({ username: 'talento', role: 'MENSAJERO', password: '' }))
        expect(res.success).toBe(true)
        expect(sessions.revokeAllSessions).toHaveBeenCalledWith(4)
    })

    it('cambio solo de correo → NO revoca', async () => {
        db.usuario.findUnique.mockImplementation(async (args: { where: { id?: number } }) => (args.where.id === 4 ? TALENTO : null))
        const { updateUserAction } = await import('@/app/actions/admin')
        const res = await updateUserAction(4, form({ username: 'talento', role: 'AGENCIA', agenciaId: '2', email: 'talento@institucion.test', password: '' }))
        expect(res.success).toBe(true)
        expect(sessions.revokeAllSessions).not.toHaveBeenCalled()
    })

    it('cambio de contraseña → revoca y desbloquea', async () => {
        db.usuario.findUnique.mockImplementation(async (args: { where: { id?: number } }) => (args.where.id === 4 ? TALENTO : null))
        const { updateUserAction } = await import('@/app/actions/admin')
        const res = await updateUserAction(4, form({ username: 'talento', role: 'AGENCIA', agenciaId: '2', password: 'NuevaClave9' }))
        expect(res.success).toBe(true)
        expect(sessions.revokeAllSessions).toHaveBeenCalledWith(4)
        expect(db.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }) }))
    })

    it('B-09: crear AGENCIA sin agencia → error y sin create', async () => {
        db.usuario.findUnique.mockResolvedValue(null)
        const { createUserAction } = await import('@/app/actions/admin')
        const res = await createUserAction(form({ username: 'nuevo1', role: 'AGENCIA', password: 'ClaveFuerte9' }))
        expect(res.error).toBeDefined()
        expect(db.usuario.create).not.toHaveBeenCalled()
    })

    it('no-ADMIN → (403)', async () => {
        state.user = { id: 4, username: 'talento', role: 'AGENCIA', agenciaId: 2 }
        const { updateUserAction } = await import('@/app/actions/admin')
        const res = await updateUserAction(1, form({ username: 'admin', role: 'AGENCIA', agenciaId: '2', password: '' }))
        expect(res.error).toMatch(/\(403\)/)
    })
})
