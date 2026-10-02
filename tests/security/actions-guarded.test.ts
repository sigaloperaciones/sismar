import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * SEC-003 (FOSCAL) + H-003 / C-014 (hallazgo B-04).
 *
 * El test anterior solo exigía "algún guard" en cada acción, por lo que
 * `catalogos.ts` pasaba con `requireSession` y seguía siendo un agujero de
 * autorización. Ahora cada acción exportada tiene un guard ESPERADO y, cuando
 * aplica, el permiso concreto. Añadir una acción sin declararla aquí falla.
 */

type Expected = { guard: 'requireAdmin' } | { guard: 'requireSession' } | { guard: 'requirePermission'; permiso: string }

const ACTIONS: Record<string, Record<string, Expected>> = {
    'catalogos.ts': {
        createCiudadAction: { guard: 'requireAdmin' },
        updateCiudadAction: { guard: 'requireAdmin' },
        deleteCiudadAction: { guard: 'requireAdmin' },
        createEmpresaMensajeriaAction: { guard: 'requireAdmin' },
        updateEmpresaMensajeriaAction: { guard: 'requireAdmin' },
        deleteEmpresaMensajeriaAction: { guard: 'requireAdmin' },
        createAgenciaAction: { guard: 'requireAdmin' },
        updateAgenciaAction: { guard: 'requireAdmin' },
        deleteAgenciaAction: { guard: 'requireAdmin' },
        createCentroCostoAction: { guard: 'requireAdmin' },
        updateCentroCostoAction: { guard: 'requireAdmin' },
        deleteCentroCostoAction: { guard: 'requireAdmin' },
        createSedeAction: { guard: 'requireAdmin' },
        updateSedeAction: { guard: 'requireAdmin' },
        deleteSedeAction: { guard: 'requireAdmin' },
    },
    'admin.ts': {
        saveEmpresaConfigAction: { guard: 'requireAdmin' },
        createUserAction: { guard: 'requireAdmin' },
        updateUserAction: { guard: 'requireAdmin' },
        deleteUserAction: { guard: 'requireAdmin' },
        savePermissionMatrixAction: { guard: 'requireAdmin' },
    },
    'correspondencia.ts': {
        registerIncomingMail: { guard: 'requirePermission', permiso: 'PERMISOS.ENTRANTE_CREAR' },
        registerOutgoingMail: { guard: 'requirePermission', permiso: 'PERMISOS.SALIENTE_CREAR' },
        // El permiso depende del tipo REAL del registro (ambos deben aparecer).
        // R-033: requireSession ANTES de la BD y assertPermission con el tipo real del registro.
        updateMailAction: { guard: 'requirePermission', permiso: 'assertPermission(ctx, existing.tipo === "SALIENTE" ? PERMISOS.SALIENTE_CREAR : PERMISOS.ENTRANTE_CREAR)' },
    },
    'planillas.ts': {
        generatePlanillaAction: { guard: 'requirePermission', permiso: 'PERMISOS.PLANILLAS_CREAR' },
        closePlanillaAction: { guard: 'requirePermission', permiso: 'PERMISOS.PLANILLAS_GESTIONAR' },
        reopenPlanillaAction: { guard: 'requirePermission', permiso: 'PERMISOS.PLANILLAS_GESTIONAR' },
        removeCorrespondenciaFromPlanillaAction: { guard: 'requirePermission', permiso: 'PERMISOS.PLANILLAS_GESTIONAR' },
        processPlanillaAction: { guard: 'requirePermission', permiso: 'PERMISOS.RECIBIR' },
        uploadPlanillaFirmaAction: { guard: 'requirePermission', permiso: 'PERMISOS.PLANILLAS_GESTIONAR' },
    },
    'recorridos.ts': {
        createRecorridoAction: { guard: 'requirePermission', permiso: 'PERMISOS.RECORRIDOS_GESTIONAR' },
        anularRecorridoAction: { guard: 'requirePermission', permiso: 'PERMISOS.RECORRIDOS_GESTIONAR' },
        // Delegan en loadPiezaParaRecepcion, que exige PERMISOS.RECIBIR + pertenencia.
        aprobarCorrespondenciaAction: { guard: 'requirePermission', permiso: 'loadPiezaParaRecepcion' },
        devolverCorrespondenciaAction: { guard: 'requirePermission', permiso: 'loadPiezaParaRecepcion' },
        confirmDeliveryAction: { guard: 'requirePermission', permiso: 'aprobarCorrespondenciaAction' },
        returnCorrespondenceAction: { guard: 'requirePermission', permiso: 'devolverCorrespondenciaAction' },
        checkPlanillasAbiertas: { guard: 'requirePermission', permiso: 'PERMISOS.RECORRIDOS_VER' },
    },
}

function exportedFunctionChunks(source: string): Map<string, string> {
    const marker = /export async function\s+(\w+)/g
    const indices: { name: string; start: number }[] = []
    let m: RegExpExecArray | null
    while ((m = marker.exec(source)) !== null) {
        indices.push({ name: m[1], start: m.index })
    }
    const map = new Map<string, string>()
    indices.forEach((entry, i) => {
        map.set(entry.name, source.slice(entry.start, indices[i + 1]?.start ?? source.length))
    })
    return map
}

/** Elimina comentarios de línea y de bloque: un permiso citado en un comentario NO cuenta (R-036). */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function readAction(file: string): string {
    return stripComments(readFileSync(path.resolve(__dirname, '../../src/app/actions', file), 'utf-8'))
}

describe('C-014: cada server action usa el guard ESPERADO (no uno genérico)', () => {
    for (const [file, expected] of Object.entries(ACTIONS)) {
        const source = readAction(file)
        const chunks = exportedFunctionChunks(source)

        it(`${file}: no hay acciones exportadas sin declarar en el mapa`, () => {
            const undeclared = [...chunks.keys()].filter(n => !(n in expected))
            expect(undeclared, `Acciones nuevas sin guard declarado: ${undeclared.join(', ')}`).toEqual([])
        })

        for (const [name, exp] of Object.entries(expected)) {
            it(`${file}#${name} → ${exp.guard}${'permiso' in exp ? ` (${exp.permiso})` : ''}`, () => {
                const body = chunks.get(name)
                expect(body, `la acción ${name} ya no existe`).toBeDefined()
                if (exp.guard === 'requireAdmin') {
                    expect(body).toMatch(/await\s+requireAdmin\s*\(/)
                    expect(body, 'requireSession genérico no es suficiente para catálogos/admin').not.toMatch(/await\s+requireSession\s*\(/)
                } else if (exp.guard === 'requireSession') {
                    expect(body).toMatch(/await\s+requireSession\s*\(/)
                } else {
                    expect(body).toContain(exp.permiso)
                    const delegated = /loadPiezaParaRecepcion|assertPermission/.test(exp.permiso) || exp.permiso.endsWith('Action')
                    if (!delegated) {
                        expect(body).toMatch(/await\s+requirePermission\s*\(/)
                    } else if (/assertPermission/.test(exp.permiso)) {
                        // el guard de sesión debe ir ANTES del primer acceso a la BD
                        const guardIdx = body!.search(/await\s+requireSession\s*\(/)
                        const dbIdx = body!.indexOf('prisma.')
                        expect(guardIdx).toBeGreaterThan(-1)
                        expect(guardIdx).toBeLessThan(dbIdx)
                    }
                }
            })
        }
    }

    it('auth-guard: requireAdmin local duplicado eliminado de admin.ts (M-01 deuda)', () => {
        const source = readAction('admin.ts')
        expect(source).not.toMatch(/async function requireAdmin\s*\(/)
        expect(source).toMatch(/from "@\/lib\/auth-guard"/)
    })

    it('las acciones que delegan en loadPiezaParaRecepcion: el helper exige RECIBIR + pertenencia', () => {
        const source = readAction('recorridos.ts')
        const start = source.indexOf('async function loadPiezaParaRecepcion')
        expect(start).toBeGreaterThan(-1)
        const body = source.slice(start, source.indexOf('export async function aprobarCorrespondenciaAction'))
        expect(body).toMatch(/requirePermission\(PERMISOS\.RECIBIR\)/)
        expect(body).toMatch(/assertAgenciaAccess\(/)
    })
})
