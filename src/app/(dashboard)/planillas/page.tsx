import { prisma } from "@/lib/prisma"
import PlanillasClient from "./PlanillasClient"
import AccessDenied from "@/components/AccessDenied"
import { can, requirePagePermission } from "@/lib/auth-guard"
import { PERMISOS } from "@/lib/permissions-catalog"
import { agenciaWhere, correspondenciaWhere, isGlobalScope, planillaWhere } from "@/lib/tenancy"

export const revalidate = 0

export default async function PlanillasPage() {
    // H-003 / C-007 (M-01): permiso explícito del módulo.
    const auth = await requirePagePermission(PERMISOS.PLANILLAS_VER)
    if (!auth.ok) return <AccessDenied permiso={auth.permiso} />
    const ctx = auth.ctx

    const [canCreate, canManage] = await Promise.all([
        can(ctx, PERMISOS.PLANILLAS_CREAR),
        can(ctx, PERMISOS.PLANILLAS_GESTIONAR),
    ])
    // Las planillas salientes agrupan todas las agencias: solo alcance global.
    const canCreateSaliente = canCreate && isGlobalScope(ctx)

    // H-003 / C-002 (A-01): todo el contenido se limita al alcance del usuario.
    const tenancyC = correspondenciaWhere(ctx)
    const tenancyP = planillaWhere(ctx)

    // 1. Agencias con correspondencia pendiente ENTRANTE
    const agenciesEntrante = await prisma.agencia.findMany({
        where: agenciaWhere(ctx),
        include: {
            correspondenciaRecibida: {
                where: { estado: "POR_ENTREGAR", planillaId: null, tipo: "ENTRANTE" }
            }
        }
    })

    // 2. Correspondencia saliente pendiente (sin agrupar por agencia)
    const pendingSalienteCount = await prisma.correspondencia.count({
        where: { AND: [tenancyC, { estado: "POR_ENTREGAR", planillaId: null, tipo: "SALIENTE" }] }
    })

    // 3. Planillas recientes ENTRANTE
    const recentPlanillasEntrante = await prisma.planilla.findMany({
        where: { AND: [tenancyP, { tipo: "ENTRANTE" }] },
        orderBy: { fechaGeneracion: "desc" },
        take: 20,
        include: { agencia: true, correspondencias: { where: tenancyC } }
    })

    // 4. Planillas recientes SALIENTE
    const recentPlanillasSaliente = await prisma.planilla.findMany({
        where: { AND: [tenancyP, { tipo: "SALIENTE" }] },
        orderBy: { fechaGeneracion: "desc" },
        take: 20,
        include: { agencia: true, correspondencias: { where: tenancyC } }
    })

    const agenciesWithPendingEntrante = agenciesEntrante.filter(a => a.correspondenciaRecibida.length > 0)

    return (
        <PlanillasClient
            agenciesWithPendingEntrante={agenciesWithPendingEntrante}
            pendingSalienteCount={pendingSalienteCount}
            recentPlanillasEntrante={recentPlanillasEntrante}
            recentPlanillasSaliente={recentPlanillasSaliente}
            canCreate={canCreate}
            canCreateSaliente={canCreateSaliente}
            canManage={canManage}
        />
    )
}
