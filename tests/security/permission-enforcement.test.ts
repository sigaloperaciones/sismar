import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Req. cliente #2 (Guardian) — Enforcement de permisos de agencia.
 *
 * El cliente reportó que usuarios AGENCIA podían registrar correspondencia aun
 * con el permiso denegado, y que había que denegar por usuario individual.
 * Causas: (a) `updateMailAction` (flujo "Completar") solo exigía sesión, no
 * permiso; (b) la resolución de permisos debe respetar la denegación del rol.
 *
 * Estos tests fijan el comportamiento correcto (regresión).
 */

// ── 1) hasPermission / getUserPermissions: la denegación del rol se respeta ────
vi.mock('@/lib/prisma', () => ({
    prisma: {
        permiso: { findUnique: vi.fn() },
        usuarioPermiso: { findUnique: vi.fn(), findMany: vi.fn() },
        rolPermiso: { findUnique: vi.fn(), findMany: vi.fn() },
    },
}))

import { prisma } from '@/lib/prisma'
import { hasPermission, getUserPermissions } from '@/lib/permissions'

const PERMISO = { id: 42, codigo: 'correspondencia.entrante.crear' }

describe('Req#2: hasPermission respeta rol y overrides', () => {
    beforeEach(() => {
        vi.mocked(prisma.permiso.findUnique).mockResolvedValue(PERMISO as any)
        vi.mocked(prisma.usuarioPermiso.findUnique).mockReset()
        vi.mocked(prisma.rolPermiso.findUnique).mockReset()
    })

    it('rol AGENCIA con permiso DENEGADO y sin override → false', async () => {
        vi.mocked(prisma.usuarioPermiso.findUnique).mockResolvedValue(null as any)
        vi.mocked(prisma.rolPermiso.findUnique).mockResolvedValue({ concedido: false } as any)
        expect(await hasPermission(9, 'AGENCIA', PERMISO.codigo)).toBe(false)
    })

    it('rol AGENCIA con permiso CONCEDIDO y sin override → true', async () => {
        vi.mocked(prisma.usuarioPermiso.findUnique).mockResolvedValue(null as any)
        vi.mocked(prisma.rolPermiso.findUnique).mockResolvedValue({ concedido: true } as any)
        expect(await hasPermission(9, 'AGENCIA', PERMISO.codigo)).toBe(true)
    })

    it('override de usuario DENIEGA aunque el rol lo conceda → false', async () => {
        vi.mocked(prisma.usuarioPermiso.findUnique).mockResolvedValue({ concedido: false } as any)
        vi.mocked(prisma.rolPermiso.findUnique).mockResolvedValue({ concedido: true } as any)
        expect(await hasPermission(9, 'AGENCIA', PERMISO.codigo)).toBe(false)
    })

    it('sin fila de rol → false (deniega por defecto)', async () => {
        vi.mocked(prisma.usuarioPermiso.findUnique).mockResolvedValue(null as any)
        vi.mocked(prisma.rolPermiso.findUnique).mockResolvedValue(null as any)
        expect(await hasPermission(9, 'AGENCIA', PERMISO.codigo)).toBe(false)
    })
})

describe('Req#2: getUserPermissions (usado por el menú) refleja overrides', () => {
    it('quita del set el permiso con override denegado', async () => {
        vi.mocked(prisma.rolPermiso.findMany).mockResolvedValue([
            { permiso: { codigo: 'correspondencia.entrante.crear' } },
            { permiso: { codigo: 'correspondencia.entrante.ver' } },
        ] as any)
        vi.mocked(prisma.usuarioPermiso.findMany).mockResolvedValue([
            { concedido: false, permiso: { codigo: 'correspondencia.entrante.crear' } },
        ] as any)

        const set = await getUserPermissions(9, 'AGENCIA')
        expect(set.has('correspondencia.entrante.ver')).toBe(true)
        expect(set.has('correspondencia.entrante.crear')).toBe(false)
    })
})

// ── 2) updateMailAction exige permiso de creación (no solo sesión) ─────────────
describe('Req#2: updateMailAction exige requirePermission de creación', () => {
    it('el cuerpo de updateMailAction invoca requirePermission con permiso .crear', () => {
        const full = path.resolve(__dirname, '../../src/app/actions/correspondencia.ts')
        const source = readFileSync(full, 'utf-8')
        const start = source.indexOf('export async function updateMailAction')
        expect(start).toBeGreaterThan(-1)
        const nextExport = source.indexOf('export async function', start + 1)
        const body = source.slice(start, nextExport === -1 ? source.length : nextExport)

        expect(/requirePermission\s*\(/.test(body)).toBe(true)
        expect(body).toContain('correspondencia.saliente.crear')
        expect(body).toContain('correspondencia.entrante.crear')
    })
})
