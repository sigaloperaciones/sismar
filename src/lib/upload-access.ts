import { prisma } from './prisma'
import { uploadFilenameFromUrl } from './uploads'
import { canAccessAgencia, scopeFor } from './tenancy'
import type { AuthContext } from './auth-guard'

/**
 * ACL por objeto para archivos (H-003 / C-006 — hallazgo A-06).
 *
 * Un archivo solo se sirve si está referenciado por un objeto que el usuario
 * puede ver:
 *  - `EmpresaConfig.logoUrl`          → cualquier sesión válida.
 *  - `Correspondencia.guiaUrl` /
 *    `Correspondencia.documentoRecibidoUrl` → tenencia de la agencia de la pieza.
 *  - `Planilla.documentoFirmaUrl`     → tenencia de la planilla (entrante por
 *    agenciaId; saliente si contiene piezas de la agencia).
 *  - No referenciado por nadie        → NOT_FOUND (no se sirven huérfanos).
 */
export type UploadAccess = 'ALLOW' | 'FORBIDDEN' | 'NOT_FOUND'

export async function resolveUploadAccess(ctx: AuthContext, filename: string): Promise<UploadAccess> {
    if (!filename) return 'NOT_FOUND'

    const matches = (url: string | null) => uploadFilenameFromUrl(url) === filename

    const [config, piezas, planillas] = await Promise.all([
        prisma.empresaConfig.findFirst({ select: { logoUrl: true } }),
        prisma.correspondencia.findMany({
            where: { OR: [{ guiaUrl: { contains: filename } }, { documentoRecibidoUrl: { contains: filename } }] },
            select: { id: true, agenciaId: true, guiaUrl: true, documentoRecibidoUrl: true },
            take: 20,
        }),
        prisma.planilla.findMany({
            where: { documentoFirmaUrl: { contains: filename } },
            select: {
                id: true,
                agenciaId: true,
                documentoFirmaUrl: true,
            },
            take: 20,
        }),
    ])

    let referenced = false
    let allowed = false

    if (config?.logoUrl && matches(config.logoUrl)) {
        referenced = true
        allowed = true
    }

    for (const p of piezas) {
        if (!(matches(p.guiaUrl) || matches(p.documentoRecibidoUrl))) continue
        referenced = true
        if (canAccessAgencia(ctx, p.agenciaId)) allowed = true
    }

    const scope = scopeFor(ctx)
    for (const pl of planillas) {
        if (!matches(pl.documentoFirmaUrl)) continue
        referenced = true
        if (scope.kind === 'GLOBAL') allowed = true
        // R-030 (AC-018): la firma de una planilla SALIENTE es la hoja impresa con las
        // piezas de TODAS las agencias → solo alcance global. Una AGENCIA solo accede a
        // la firma de sus planillas ENTRANTES (agenciaId propio).
        else if (scope.kind === 'AGENCIA' && pl.agenciaId === scope.agenciaId) allowed = true
    }

    if (!referenced) return 'NOT_FOUND'
    return allowed ? 'ALLOW' : 'FORBIDDEN'
}
