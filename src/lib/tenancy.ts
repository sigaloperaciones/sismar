import type { Prisma } from '@prisma/client'
import { ForbiddenError, type AuthContext } from './auth-guard'
import { audit } from './audit'

/**
 * Tenencia por agencia (H-003 / C-002, C-003, C-004 — hallazgos A-01…A-03).
 *
 * ÚNICO lugar donde se decide qué alcance tiene cada rol. Ninguna página ni
 * acción arma filtros de agencia por su cuenta.
 *
 *  - ADMIN y MENSAJERO: alcance GLOBAL (operación logística de toda la institución).
 *  - AGENCIA: solo su `agenciaId` (leído de BD en cada petición).
 *  - AGENCIA sin agencia asignada: alcance VACÍO (deniega por defecto).
 */

export type Scope =
    | { kind: 'GLOBAL' }
    | { kind: 'AGENCIA'; agenciaId: number }
    | { kind: 'NONE' }

export type ScopeInput = Pick<AuthContext, 'role' | 'agenciaId'>

/** Filtro Prisma que no devuelve ninguna fila (para alcance vacío). */
const NOTHING = { id: { in: [] as number[] } }

export function scopeFor(ctx: ScopeInput): Scope {
    if (ctx.role === 'ADMIN' || ctx.role === 'MENSAJERO') return { kind: 'GLOBAL' }
    if (ctx.role === 'AGENCIA') {
        return typeof ctx.agenciaId === 'number'
            ? { kind: 'AGENCIA', agenciaId: ctx.agenciaId }
            : { kind: 'NONE' }
    }
    return { kind: 'NONE' }
}

export function isGlobalScope(ctx: ScopeInput): boolean {
    return scopeFor(ctx).kind === 'GLOBAL'
}

/** Filtro de tenencia para `Correspondencia`. */
export function correspondenciaWhere(ctx: ScopeInput): Prisma.CorrespondenciaWhereInput {
    const scope = scopeFor(ctx)
    if (scope.kind === 'GLOBAL') return {}
    if (scope.kind === 'AGENCIA') return { agenciaId: scope.agenciaId }
    return NOTHING
}

/**
 * Filtro de tenencia para `Planilla`. Una AGENCIA ve sus planillas entrantes
 * (agenciaId propio) y las planillas salientes que contengan al menos una
 * pieza suya (las salientes agrupan varias agencias y tienen agenciaId null).
 */
export function planillaWhere(ctx: ScopeInput): Prisma.PlanillaWhereInput {
    const scope = scopeFor(ctx)
    if (scope.kind === 'GLOBAL') return {}
    if (scope.kind === 'AGENCIA') {
        return {
            OR: [
                { agenciaId: scope.agenciaId },
                { correspondencias: { some: { agenciaId: scope.agenciaId } } },
            ],
        }
    }
    return NOTHING
}

/** Filtro de tenencia para `Agencia` (listas desplegables, agrupaciones). */
export function agenciaWhere(ctx: ScopeInput): Prisma.AgenciaWhereInput {
    const scope = scopeFor(ctx)
    if (scope.kind === 'GLOBAL') return {}
    if (scope.kind === 'AGENCIA') return { id: scope.agenciaId }
    return NOTHING
}

/** ¿Puede el usuario operar sobre un objeto que pertenece a `agenciaId`? */
export function canAccessAgencia(ctx: ScopeInput, agenciaId: number | null | undefined): boolean {
    const scope = scopeFor(ctx)
    if (scope.kind === 'GLOBAL') return true
    if (scope.kind === 'AGENCIA') return typeof agenciaId === 'number' && agenciaId === scope.agenciaId
    return false
}

/**
 * Verifica pertenencia; si falla, registra ACCESO_DENEGADO y lanza ForbiddenError.
 * `entidad`/`entidadId` identifican el objeto para la bitácora.
 */
export async function assertAgenciaAccess(
    ctx: AuthContext,
    agenciaId: number | null | undefined,
    entidad: string,
    entidadId: number | string
): Promise<void> {
    if (canAccessAgencia(ctx, agenciaId)) return
    await audit({
        ctx,
        accion: 'ACCESO_DENEGADO',
        entidad,
        entidadId,
        detalle: { motivo: 'objeto de otra agencia', agenciaObjeto: agenciaId ?? null },
    })
    throw new ForbiddenError('El registro pertenece a otra agencia (403)')
}

/**
 * GESTIONAR una planilla (cerrar, reabrir, subir firma) — Guardian R-031 (AC-019).
 * Las salientes agrupan piezas de TODAS las agencias: gestionarlas exige alcance
 * global aunque la agencia tenga piezas dentro (si no, una dependencia marcaría
 * como ENTREGADO lo de las demás o reemplazaría la evidencia de envío).
 * Para LEER se usa `assertPlanillaAccess`.
 */
export async function assertPlanillaManage(
    ctx: AuthContext,
    planilla: { id: number; agenciaId: number | null; correspondencias?: Array<{ agenciaId: number }> }
): Promise<void> {
    if (planilla.agenciaId === null && !isGlobalScope(ctx)) {
        await audit({
            ctx,
            accion: 'ACCESO_DENEGADO',
            entidad: 'Planilla',
            entidadId: planilla.id,
            detalle: { motivo: 'planilla saliente compartida: gestión solo con alcance global' },
        })
        throw new ForbiddenError('Las planillas salientes solo las gestiona el alcance global (403)')
    }
    return assertPlanillaAccess(ctx, planilla)
}

/**
 * Pertenencia de LECTURA sobre una planilla: entrantes por `agenciaId`; salientes
 * (agenciaId null) solo si alguna de sus piezas es de la agencia del usuario.
 */
export async function assertPlanillaAccess(
    ctx: AuthContext,
    planilla: { id: number; agenciaId: number | null; correspondencias?: Array<{ agenciaId: number }> }
): Promise<void> {
    const scope = scopeFor(ctx)
    if (scope.kind === 'GLOBAL') return
    if (scope.kind === 'AGENCIA') {
        if (planilla.agenciaId === scope.agenciaId) return
        if (planilla.agenciaId === null && planilla.correspondencias?.some(c => c.agenciaId === scope.agenciaId)) return
    }
    await audit({
        ctx,
        accion: 'ACCESO_DENEGADO',
        entidad: 'Planilla',
        entidadId: planilla.id,
        detalle: { motivo: 'planilla de otra agencia', agenciaObjeto: planilla.agenciaId },
    })
    throw new ForbiddenError('La planilla pertenece a otra agencia (403)')
}
