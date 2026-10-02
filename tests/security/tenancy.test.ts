import { describe, it, expect, vi } from 'vitest'

/**
 * H-003 / C-002 (hallazgo A-01) — Tenencia por agencia.
 * Funciones puras de `lib/tenancy`: el alcance de cada rol y los filtros Prisma.
 */
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))

import { scopeFor, correspondenciaWhere, planillaWhere, agenciaWhere, canAccessAgencia, assertAgenciaAccess, assertPlanillaAccess, assertPlanillaManage } from '@/lib/tenancy'
import { ForbiddenError, type AuthContext } from '@/lib/auth-guard'
import { audit } from '@/lib/audit'

const ADMIN = { role: 'ADMIN', agenciaId: null } as const
const MENSAJERO = { role: 'MENSAJERO', agenciaId: null } as const
const AGENCIA1 = { role: 'AGENCIA', agenciaId: 1 } as const
const AGENCIA_SIN = { role: 'AGENCIA', agenciaId: null } as const

const ctx = (base: { role: string; agenciaId: number | null }): AuthContext =>
    ({ userId: 9, username: 'u', sid: 's', role: base.role as AuthContext['role'], agenciaId: base.agenciaId })

describe('S-004/S-005: scopeFor', () => {
    it('ADMIN y MENSAJERO → GLOBAL', () => {
        expect(scopeFor(ADMIN)).toEqual({ kind: 'GLOBAL' })
        expect(scopeFor(MENSAJERO)).toEqual({ kind: 'GLOBAL' })
    })
    it('AGENCIA con agencia → AGENCIA', () => {
        expect(scopeFor(AGENCIA1)).toEqual({ kind: 'AGENCIA', agenciaId: 1 })
    })
    it('AGENCIA sin agencia → NONE (deniega por defecto)', () => {
        expect(scopeFor(AGENCIA_SIN)).toEqual({ kind: 'NONE' })
    })
    it('rol desconocido → NONE', () => {
        expect(scopeFor({ role: 'HACKER', agenciaId: 1 } as never)).toEqual({ kind: 'NONE' })
    })
})

describe('filtros Prisma', () => {
    it('correspondenciaWhere: global vacío, agencia filtra, none imposible', () => {
        expect(correspondenciaWhere(ADMIN)).toEqual({})
        expect(correspondenciaWhere(AGENCIA1)).toEqual({ agenciaId: 1 })
        expect(correspondenciaWhere(AGENCIA_SIN)).toEqual({ id: { in: [] } })
    })
    it('planillaWhere: agencia ve sus entrantes y las salientes con piezas suyas', () => {
        expect(planillaWhere(MENSAJERO)).toEqual({})
        expect(planillaWhere(AGENCIA1)).toEqual({
            OR: [{ agenciaId: 1 }, { correspondencias: { some: { agenciaId: 1 } } }],
        })
        expect(planillaWhere(AGENCIA_SIN)).toEqual({ id: { in: [] } })
    })
    it('agenciaWhere: agencia solo se ve a sí misma', () => {
        expect(agenciaWhere(ADMIN)).toEqual({})
        expect(agenciaWhere(AGENCIA1)).toEqual({ id: 1 })
        expect(agenciaWhere(AGENCIA_SIN)).toEqual({ id: { in: [] } })
    })
})

describe('canAccessAgencia / assert*', () => {
    it('GLOBAL accede a cualquier agencia; AGENCIA solo a la suya; NONE a ninguna', () => {
        expect(canAccessAgencia(ADMIN, 7)).toBe(true)
        expect(canAccessAgencia(ADMIN, null)).toBe(true)
        expect(canAccessAgencia(AGENCIA1, 1)).toBe(true)
        expect(canAccessAgencia(AGENCIA1, 2)).toBe(false)
        expect(canAccessAgencia(AGENCIA1, null)).toBe(false)
        expect(canAccessAgencia(AGENCIA_SIN, 1)).toBe(false)
    })

    it('assertAgenciaAccess lanza ForbiddenError (403) y registra ACCESO_DENEGADO', async () => {
        vi.mocked(audit).mockClear()
        await expect(assertAgenciaAccess(ctx(AGENCIA1), 2, 'Correspondencia', 77)).rejects.toBeInstanceOf(ForbiddenError)
        await expect(assertAgenciaAccess(ctx(AGENCIA1), 2, 'Correspondencia', 77)).rejects.toThrow('(403)')
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ACCESO_DENEGADO', entidad: 'Correspondencia', entidadId: 77 }))
        await expect(assertAgenciaAccess(ctx(AGENCIA1), 1, 'Correspondencia', 78)).resolves.toBeUndefined()
    })

    it('assertPlanillaAccess: entrante por agenciaId, saliente por contenido', async () => {
        await expect(assertPlanillaAccess(ctx(AGENCIA1), { id: 5, agenciaId: 1 })).resolves.toBeUndefined()
        await expect(assertPlanillaAccess(ctx(AGENCIA1), { id: 6, agenciaId: 2 })).rejects.toThrow('(403)')
        await expect(assertPlanillaAccess(ctx(AGENCIA1), { id: 7, agenciaId: null, correspondencias: [{ agenciaId: 1 }, { agenciaId: 2 }] })).resolves.toBeUndefined()
        await expect(assertPlanillaAccess(ctx(AGENCIA1), { id: 8, agenciaId: null, correspondencias: [{ agenciaId: 2 }] })).rejects.toThrow('(403)')
        await expect(assertPlanillaAccess(ctx(MENSAJERO), { id: 8, agenciaId: null })).resolves.toBeUndefined()
        await expect(assertPlanillaAccess(ctx(AGENCIA_SIN), { id: 5, agenciaId: null })).rejects.toThrow('(403)')
    })
})

describe('R-031 / AC-019: assertPlanillaManage (gestionar ≠ leer)', () => {
    it('una saliente compartida solo la GESTIONA el alcance global, aunque la agencia tenga piezas en ella', async () => {
        const saliente = { id: 7, agenciaId: null, correspondencias: [{ agenciaId: 1 }, { agenciaId: 2 }] }
        await expect(assertPlanillaAccess(ctx(AGENCIA1), saliente)).resolves.toBeUndefined() // leer: sí
        await expect(assertPlanillaManage(ctx(AGENCIA1), saliente)).rejects.toThrow('(403)') // gestionar: no
        await expect(assertPlanillaManage(ctx(MENSAJERO), saliente)).resolves.toBeUndefined()
    })
    it('una entrante propia sí se gestiona; una ajena no', async () => {
        await expect(assertPlanillaManage(ctx(AGENCIA1), { id: 5, agenciaId: 1 })).resolves.toBeUndefined()
        await expect(assertPlanillaManage(ctx(AGENCIA1), { id: 6, agenciaId: 2 })).rejects.toThrow('(403)')
    })
})
