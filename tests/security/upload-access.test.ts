import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * H-003 / C-006 (hallazgo A-06) — ACL por objeto para archivos.
 */
const db = vi.hoisted(() => ({
    empresaConfig: { findFirst: vi.fn() },
    correspondencia: { findMany: vi.fn() },
    planilla: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))

import { resolveUploadAccess } from '@/lib/upload-access'
import type { AuthContext } from '@/lib/auth-guard'

const ctx = (role: string, agenciaId: number | null): AuthContext =>
    ({ userId: 1, username: 'u', sid: 's', role: role as AuthContext['role'], agenciaId })

beforeEach(() => {
    db.empresaConfig.findFirst.mockResolvedValue({ logoUrl: null })
    db.correspondencia.findMany.mockResolvedValue([])
    db.planilla.findMany.mockResolvedValue([])
})

describe('S-013: resolveUploadAccess', () => {
    it('archivo no referenciado por ningún objeto → NOT_FOUND (ni para ADMIN)', async () => {
        expect(await resolveUploadAccess(ctx('ADMIN', null), 'huerfano.pdf')).toBe('NOT_FOUND')
    })

    it('guía de una pieza de otra agencia → FORBIDDEN; de la propia → ALLOW; global → ALLOW', async () => {
        db.correspondencia.findMany.mockResolvedValue([{ id: 1, agenciaId: 2, guiaUrl: '/api/uploads?filename=g1.pdf', documentoRecibidoUrl: null }])
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'g1.pdf')).toBe('FORBIDDEN')
        expect(await resolveUploadAccess(ctx('AGENCIA', 2), 'g1.pdf')).toBe('ALLOW')
        expect(await resolveUploadAccess(ctx('MENSAJERO', null), 'g1.pdf')).toBe('ALLOW')
    })

    it('coincidencia exacta de nombre: "a.pdf" no autoriza "ba.pdf" (contains en BD, igualdad aquí)', async () => {
        db.correspondencia.findMany.mockResolvedValue([{ id: 1, agenciaId: 1, guiaUrl: '/uploads/ba.pdf', documentoRecibidoUrl: null }])
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'a.pdf')).toBe('NOT_FOUND')
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'ba.pdf')).toBe('ALLOW')
    })

    it('R-030/AC-018: la firma de una planilla SALIENTE (hoja impresa de TODAS las agencias) solo con alcance global', async () => {
        db.planilla.findMany.mockResolvedValue([{ id: 9, agenciaId: null, documentoFirmaUrl: '/api/uploads?filename=firma.pdf', correspondencias: [{ agenciaId: 2 }] }])
        expect(await resolveUploadAccess(ctx('AGENCIA', 2), 'firma.pdf')).toBe('FORBIDDEN') // aunque tenga una pieza en ella
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'firma.pdf')).toBe('FORBIDDEN')
        expect(await resolveUploadAccess(ctx('ADMIN', null), 'firma.pdf')).toBe('ALLOW')
        expect(await resolveUploadAccess(ctx('MENSAJERO', null), 'firma.pdf')).toBe('ALLOW')
    })
    it('la firma de una planilla ENTRANTE propia sí es accesible para su agencia', async () => {
        db.planilla.findMany.mockResolvedValue([{ id: 10, agenciaId: 2, documentoFirmaUrl: '/api/uploads?filename=firma-e.pdf', correspondencias: [{ agenciaId: 2 }] }])
        expect(await resolveUploadAccess(ctx('AGENCIA', 2), 'firma-e.pdf')).toBe('ALLOW')
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'firma-e.pdf')).toBe('FORBIDDEN')
    })

    it('el logo de la empresa es accesible para cualquier sesión', async () => {
        db.empresaConfig.findFirst.mockResolvedValue({ logoUrl: '/api/uploads?filename=logo.png' })
        expect(await resolveUploadAccess(ctx('AGENCIA', 1), 'logo.png')).toBe('ALLOW')
    })

    it('AGENCIA sin agencia asignada → FORBIDDEN aunque el archivo exista', async () => {
        db.correspondencia.findMany.mockResolvedValue([{ id: 1, agenciaId: 1, guiaUrl: '/api/uploads?filename=g1.pdf', documentoRecibidoUrl: null }])
        expect(await resolveUploadAccess(ctx('AGENCIA', null), 'g1.pdf')).toBe('FORBIDDEN')
    })
})
