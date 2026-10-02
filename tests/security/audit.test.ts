import { describe, it, expect, vi } from 'vitest'

/**
 * H-003 / C-011 (hallazgo M-07) — Bitácora de auditoría.
 */
const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { create } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.10' }) }))

import { audit } from '@/lib/audit'

describe('S-021: audit()', () => {
    it('escribe usuario, acción, entidad, detalle e IP de la petición', async () => {
        create.mockResolvedValue({})
        await audit({ ctx: { userId: 3, username: 'gerencia' }, accion: 'CORRESPONDENCIA_CREAR', entidad: 'Correspondencia', entidadId: 15, detalle: { tipo: 'ENTRANTE' } })
        expect(create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                usuarioId: 3,
                username: 'gerencia',
                accion: 'CORRESPONDENCIA_CREAR',
                entidad: 'Correspondencia',
                entidadId: '15',
                detalle: { tipo: 'ENTRANTE' },
                ip: '203.0.113.10',
            }),
        })
    })
    it('nunca interrumpe la operación aunque la BD falle', async () => {
        create.mockRejectedValueOnce(new Error('db caída'))
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(audit({ ctx: null, username: 'nadie', accion: 'LOGIN_FALLIDO' })).resolves.toBeUndefined()
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
    })
    it('un login fallido se registra con el username intentado y sin usuarioId', async () => {
        create.mockResolvedValue({})
        await audit({ username: 'intruso', accion: 'LOGIN_FALLIDO', ip: '198.51.100.1' })
        expect(create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ usuarioId: null, username: 'intruso', ip: '198.51.100.1' }) })
    })
})
