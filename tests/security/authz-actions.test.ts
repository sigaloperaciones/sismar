import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * H-003 / C-003, C-004, C-005, C-014 (hallazgos A-02, A-03, A-04, B-04).
 *
 * Tests de COMPORTAMIENTO de las server actions con sesión y Prisma simulados:
 * ya no basta con que "haya un await requireSession" en el cuerpo. Cada
 * escenario reproduce un abuse case del threat model.
 */

type Ctx = { id: number; username: string; role: string; agenciaId: number | null }
const state = { user: null as Ctx | null, perms: new Set<string>() }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
    redirect: vi.fn((u: string) => { throw Object.assign(new Error(`NEXT_REDIRECT:${u}`), { digest: `NEXT_REDIRECT;replace;${u}` }) }),
}))
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: () => ({ value: 'token' }), set: vi.fn() }),
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.5' }),
}))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))
vi.mock('@/lib/notifications', () => ({ sendMail: vi.fn(async () => ({ sent: false })) }))
vi.mock('@/lib/uploads', () => ({ saveUploadedFile: vi.fn() }))
vi.mock('@/lib/auth', () => ({
    getSessionPayload: async () => (state.user ? { sid: 's1', userId: state.user.id, username: state.user.username, role: state.user.role } : null),
}))
vi.mock('@/lib/session-store', () => ({
    resolveSession: async () => (state.user
        ? { session: { id: 's1', usuarioId: state.user.id, expiresAt: new Date(Date.now() + 60_000) }, user: state.user }
        : null),
    revokeAllSessions: vi.fn(async () => 0),
}))
vi.mock('@/lib/permissions', async () => {
    const cat = await vi.importActual<typeof import('@/lib/permissions-catalog')>('@/lib/permissions-catalog')
    return {
        PERMISOS: cat.PERMISOS,
        hasPermission: async (_u: number, _r: string, code: string) => state.perms.has(code),
        getUserPermissions: async () => state.perms,
    }
})

const db = {
    correspondencia: { findUnique: vi.fn(), update: vi.fn(async () => ({ id: 1, tipo: 'ENTRANTE', agenciaId: 1, agencia: { email: null } })), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    planilla: { findUnique: vi.fn(), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })), findFirst: vi.fn(), findMany: vi.fn() },
    recorridoPlanilla: { findFirst: vi.fn(async () => null), createMany: vi.fn() },
    recorrido: { update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    agencia: { create: vi.fn(async () => ({ id: 10 })), count: vi.fn(), findUnique: vi.fn() },
    ciudad: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 1 })) },
    empresaMensajeria: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 1 })) },
    usuario: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
}
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { audit } from '@/lib/audit'
import { PERMISOS } from '@/lib/permissions-catalog'

const GERENCIA: Ctx = { id: 3, username: 'gerencia', role: 'AGENCIA', agenciaId: 1 }
const TALENTO: Ctx = { id: 4, username: 'talento', role: 'AGENCIA', agenciaId: 2 }
const MENSAJERO: Ctx = { id: 2, username: 'mensajero', role: 'MENSAJERO', agenciaId: null }
const ADMIN: Ctx = { id: 1, username: 'admin', role: 'ADMIN', agenciaId: null }

function as(user: Ctx | null, perms: string[] = []) {
    state.user = user
    state.perms = new Set(perms)
}

function formUpdate(id: number, extra: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('id', String(id))
    fd.set('asunto', 'Asunto de prueba')
    fd.set('importancia', 'NORMAL')
    fd.set('remitenteNombre', 'Remitente X')
    for (const [k, v] of Object.entries(extra)) fd.set(k, v)
    return fd
}

beforeEach(() => {
    vi.mocked(audit).mockClear()
    for (const model of Object.values(db)) {
        if (typeof model === 'function') continue
        for (const fn of Object.values(model)) (fn as ReturnType<typeof vi.fn>).mockClear()
    }
})

// ── C-003: updateMailAction ──────────────────────────────────────────────────
describe('S-006/S-007: updateMailAction (A-02 IDOR)', () => {
    it('AGENCIA no puede editar una pieza de otra agencia → (403) y sin update', async () => {
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 77, tipo: 'ENTRANTE', agenciaId: 2, estado: 'POR_ENTREGAR' })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        const res = await updateMailAction(null, formUpdate(77))
        expect(res.error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ACCESO_DENEGADO' }))
    })

    it('el permiso se evalúa con el tipo REAL del registro, no con el tipo enviado', async () => {
        // Solo tiene permiso de ENTRANTE; el registro es SALIENTE; el formulario miente diciendo ENTRANTE.
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 78, tipo: 'SALIENTE', agenciaId: 1, estado: 'POR_ENTREGAR' })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        const res = await updateMailAction(null, formUpdate(78, { tipo: 'ENTRANTE' }))
        expect(res.error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })

    it('AGENCIA edita su propia pieza → éxito, con autoría (updatedBy)', async () => {
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 79, tipo: 'ENTRANTE', agenciaId: 1, estado: 'POR_ENTREGAR', planillaId: null })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        const res = await updateMailAction(null, formUpdate(79))
        expect(res.error).toBeUndefined()
        expect(res.success).toBe(true)
        expect(db.correspondencia.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 79 },
            data: expect.objectContaining({ updatedBy: 'gerencia' }),
        }))
    })

    it('AGENCIA no puede reasignar la pieza a otra agencia → (403)', async () => {
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 80, tipo: 'ENTRANTE', agenciaId: 1, estado: 'POR_ENTREGAR', planillaId: null })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        const res = await updateMailAction(null, formUpdate(80, { agenciaId: '2' }))
        expect(res.error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })

    it('B-06: entrada inválida se rechaza por Zod antes de tocar la BD', async () => {
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        const fd = new FormData(); fd.set('id', 'abc'); fd.set('asunto', 'x'); fd.set('importancia', 'URGENTISIMA')
        const res = await updateMailAction(null, fd)
        expect(res.error).toBeDefined()
        expect(db.correspondencia.findUnique).not.toHaveBeenCalled()
    })

    it('R-033: cookie sin sesión viva → redirección de salida ANTES de tocar la BD (sin oráculo de existencia)', async () => {
        as(null)
        db.correspondencia.findUnique.mockResolvedValue({ id: 77, tipo: 'ENTRANTE', agenciaId: 2, estado: 'POR_ENTREGAR' })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        await expect(updateMailAction(null, formUpdate(77))).rejects.toThrow('NEXT_REDIRECT:/api/auth/expired')
        expect(db.correspondencia.findUnique).not.toHaveBeenCalled()
    })

    it('R-034: no se edita una pieza ya gestionada ni una que está en planilla (cadena de custodia)', async () => {
        as(ADMIN, [PERMISOS.ENTRANTE_CREAR, PERMISOS.SALIENTE_CREAR])
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        db.correspondencia.findUnique.mockResolvedValue({ id: 81, tipo: 'ENTRANTE', agenciaId: 1, estado: 'ENTREGADA', planillaId: null })
        expect((await updateMailAction(null, formUpdate(81))).error).toMatch(/no se puede editar/i)
        db.correspondencia.findUnique.mockResolvedValue({ id: 82, tipo: 'ENTRANTE', agenciaId: 1, estado: 'POR_ENTREGAR', planillaId: 5 })
        expect((await updateMailAction(null, formUpdate(82))).error).toMatch(/no se puede editar/i)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })

    it('R-034: la bitácora de edición conserva los valores anteriores', async () => {
        as(GERENCIA, [PERMISOS.ENTRANTE_CREAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 83, tipo: 'ENTRANTE', agenciaId: 1, estado: 'POR_ENTREGAR', planillaId: null, asunto: 'Asunto viejo', importancia: 'ALTA', remitenteNombre: 'Viejo' })
        const { updateMailAction } = await import('@/app/actions/correspondencia')
        await updateMailAction(null, formUpdate(83))
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({
            accion: 'CORRESPONDENCIA_EDITAR',
            detalle: expect.objectContaining({ antes: expect.objectContaining({ asunto: 'Asunto viejo', importancia: 'ALTA' }) }),
        }))
    })
})

// ── C-003: aprobar / devolver ────────────────────────────────────────────────
describe('S-008: aprobar/devolver exigen correspondencia.recibir + pertenencia', () => {
    const piezaDeAgencia1 = {
        id: 79, agenciaId: 1, estado: 'POR_ENTREGAR',
        planilla: { id: 5, estado: 'CERRADA', recorridoPlanillas: [{ recorrido: { estado: 'INICIADO' } }] },
    }

    it('MENSAJERO (sin el permiso) no puede aprobar → (403)', async () => {
        as(MENSAJERO, [PERMISOS.RECORRIDOS_GESTIONAR, PERMISOS.PLANILLAS_GESTIONAR])
        db.correspondencia.findUnique.mockResolvedValue(piezaDeAgencia1)
        const { aprobarCorrespondenciaAction } = await import('@/app/actions/recorridos')
        const res = await aprobarCorrespondenciaAction(79)
        expect(res.error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })

    it('AGENCIA de otra agencia no puede aprobar → (403)', async () => {
        as(TALENTO, [PERMISOS.RECIBIR])
        db.correspondencia.findUnique.mockResolvedValue(piezaDeAgencia1)
        const { aprobarCorrespondenciaAction } = await import('@/app/actions/recorridos')
        const res = await aprobarCorrespondenciaAction(79)
        expect(res.error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })

    it('la AGENCIA dueña aprueba → ENTREGADA con recibidoPor, de forma ATÓMICA (R-041: filtra por estado)', async () => {
        as(GERENCIA, [PERMISOS.RECIBIR])
        db.correspondencia.findUnique.mockResolvedValue(piezaDeAgencia1)
        db.correspondencia.updateMany.mockResolvedValue({ count: 1 })
        const { aprobarCorrespondenciaAction } = await import('@/app/actions/recorridos')
        const res = await aprobarCorrespondenciaAction(79)
        expect(res.success).toBe(true)
        expect(db.correspondencia.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: 79, estado: 'POR_ENTREGAR' }),
            data: expect.objectContaining({ estado: 'ENTREGADA', recibidoPor: 'gerencia' }),
        }))
    })

    it('R-041: doble clic / carrera → la segunda aprobación no gana (count 0 → error, sin bitácora de aprobación)', async () => {
        as(GERENCIA, [PERMISOS.RECIBIR])
        db.correspondencia.findUnique.mockResolvedValue(piezaDeAgencia1)
        db.correspondencia.updateMany.mockResolvedValue({ count: 0 })
        const { aprobarCorrespondenciaAction } = await import('@/app/actions/recorridos')
        const res = await aprobarCorrespondenciaAction(79)
        expect(res.error).toBeDefined()
        expect(vi.mocked(audit)).not.toHaveBeenCalledWith(expect.objectContaining({ accion: 'CORRESPONDENCIA_APROBAR' }))
    })

    it('no se aprueba una pieza fuera de recorrido activo ni ya gestionada', async () => {
        as(GERENCIA, [PERMISOS.RECIBIR])
        db.correspondencia.findUnique.mockResolvedValue({ ...piezaDeAgencia1, planilla: { id: 5, estado: 'GENERADA', recorridoPlanillas: [] } })
        const { devolverCorrespondenciaAction } = await import('@/app/actions/recorridos')
        const res = await devolverCorrespondenciaAction(79, 'no corresponde')
        expect(res.error).toBeDefined()
        expect(db.correspondencia.update).not.toHaveBeenCalled()
    })
})

// ── C-004: planillas ─────────────────────────────────────────────────────────
describe('S-009/S-010: ciclo de vida de planillas (A-03)', () => {
    it('AGENCIA sin planillas.gestionar no cierra → (403)', async () => {
        as(GERENCIA, [PERMISOS.PLANILLAS_VER, PERMISOS.RECIBIR])
        db.planilla.findUnique.mockResolvedValue({ id: 5, estado: 'GENERADA', tipo: 'ENTRANTE', agenciaId: 1, correspondencias: [] })
        const { closePlanillaAction } = await import('@/app/actions/planillas')
        const res = await closePlanillaAction(5)
        expect(res.error).toMatch(/\(403\)/)
        expect(db.planilla.updateMany).not.toHaveBeenCalled()
    })

    it('MENSAJERO con planillas.gestionar cierra → CERRADA', async () => {
        as(MENSAJERO, [PERMISOS.PLANILLAS_GESTIONAR])
        db.planilla.findUnique.mockResolvedValue({ id: 5, estado: 'GENERADA', tipo: 'ENTRANTE', agenciaId: 1, correspondencias: [] })
        const { closePlanillaAction } = await import('@/app/actions/planillas')
        const res = await closePlanillaAction(5)
        expect(res.success).toBe(true)
        // transición atómica condicionada al estado actual
        expect(db.planilla.updateMany).toHaveBeenCalledWith({ where: { id: 5, estado: 'GENERADA' }, data: { estado: 'CERRADA' } })
    })

    it('incluso con el permiso, una planilla de otra agencia es (403)', async () => {
        as(GERENCIA, [PERMISOS.PLANILLAS_GESTIONAR])
        db.planilla.findUnique.mockResolvedValue({ id: 6, estado: 'GENERADA', tipo: 'ENTRANTE', agenciaId: 2, correspondencias: [] })
        const { reopenPlanillaAction } = await import('@/app/actions/planillas')
        const res = await reopenPlanillaAction(6)
        expect(res.error).toMatch(/\(403\)/)
    })

    it('processPlanilla: AGENCIA procesa solo su planilla', async () => {
        as(GERENCIA, [PERMISOS.RECIBIR])
        db.planilla.findUnique.mockResolvedValue({ id: 6, estado: 'CERRADA', tipo: 'ENTRANTE', agenciaId: 2, correspondencias: [] })
        const { processPlanillaAction } = await import('@/app/actions/planillas')
        expect((await processPlanillaAction(6)).error).toMatch(/\(403\)/)

        as(TALENTO, [PERMISOS.RECIBIR])
        const res = await processPlanillaAction(6)
        expect(res.success).toBe(true)
        expect(db.planilla.updateMany).toHaveBeenCalledWith({ where: { id: 6, estado: 'CERRADA' }, data: { estado: 'PROCESADA' } })
    })

    it('R-048: retirar una pieza de una saliente compartida exige alcance global, aunque la pieza sea propia', async () => {
        as(GERENCIA, [PERMISOS.PLANILLAS_GESTIONAR])
        db.correspondencia.findUnique.mockResolvedValue({ id: 90, agenciaId: 1, planillaId: 7, planilla: { id: 7, agenciaId: null, estado: 'GENERADA', tipo: 'SALIENTE' } })
        const { removeCorrespondenciaFromPlanillaAction } = await import('@/app/actions/planillas')
        expect((await removeCorrespondenciaFromPlanillaAction(90)).error).toMatch(/\(403\)/)
        expect(db.correspondencia.update).not.toHaveBeenCalled()
        // En su propia planilla ENTRANTE sí puede
        db.correspondencia.findUnique.mockResolvedValue({ id: 91, agenciaId: 1, planillaId: 8, planilla: { id: 8, agenciaId: 1, estado: 'GENERADA', tipo: 'ENTRANTE' } })
        expect((await removeCorrespondenciaFromPlanillaAction(91)).success).toBe(true)
    })

    it('generatePlanilla ENTRANTE: AGENCIA no genera para otra agencia', async () => {
        as(GERENCIA, [PERMISOS.PLANILLAS_CREAR])
        const { generatePlanillaAction } = await import('@/app/actions/planillas')
        const res = await generatePlanillaAction(2, 'ENTRANTE')
        expect(res.error).toMatch(/\(403\)/)
        expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('generatePlanilla SALIENTE exige alcance global (agrupa todas las agencias)', async () => {
        as(GERENCIA, [PERMISOS.PLANILLAS_CREAR])
        const { generatePlanillaAction } = await import('@/app/actions/planillas')
        const res = await generatePlanillaAction(null, 'SALIENTE')
        expect(res.error).toMatch(/\(403\)/)
    })
})

// ── C-005: catálogos ─────────────────────────────────────────────────────────
describe('S-011: catálogos solo ADMIN (A-04)', () => {
    it('AGENCIA autenticada no crea agencias, ciudades ni empresas → (403)', async () => {
        as(GERENCIA, Object.values(PERMISOS)) // aunque tuviera TODOS los permisos de la matriz
        const { createAgenciaAction, createCiudadAction, createEmpresaMensajeriaAction } = await import('@/app/actions/catalogos')

        const fdA = new FormData(); fdA.set('name', 'Nueva'); fdA.set('sedeId', '1'); fdA.set('centroCostoId', '1')
        const fdC = new FormData(); fdC.set('codigo', 'CIU01'); fdC.set('nombre', 'Ciudad'); fdC.set('departamento', 'Dpto')
        const fdE = new FormData(); fdE.set('nombre', 'Empresa')

        for (const res of [
            await createAgenciaAction(null, fdA),
            await createCiudadAction(null, fdC),
            await createEmpresaMensajeriaAction(null, fdE),
        ]) {
            expect(res.error).toMatch(/\(403\)/)
        }
        expect(db.agencia.create).not.toHaveBeenCalled()
        expect(db.ciudad.create).not.toHaveBeenCalled()
        expect(db.empresaMensajeria.create).not.toHaveBeenCalled()
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ACCESO_DENEGADO' }))
    })

    it('MENSAJERO tampoco → (403)', async () => {
        as(MENSAJERO, Object.values(PERMISOS))
        const { deleteAgenciaAction } = await import('@/app/actions/catalogos')
        expect((await deleteAgenciaAction(1)).error).toMatch(/\(403\)/)
    })

    it('ADMIN sí', async () => {
        as(ADMIN, [])
        const { createEmpresaMensajeriaAction } = await import('@/app/actions/catalogos')
        const fdE = new FormData(); fdE.set('nombre', 'Servientrega')
        const res = await createEmpresaMensajeriaAction(null, fdE)
        expect(res.success).toBe(true)
        expect(db.empresaMensajeria.create).toHaveBeenCalled()
    })
})
