import { prisma } from "@/lib/prisma"
import PlanillasClient from "./PlanillasClient"

export const revalidate = 0

export default async function PlanillasPage() {
    // 1. Obtener agencias con correspondencia pendiente ENTRANTE
    const agenciesEntrante = await prisma.agencia.findMany({
        include: {
            correspondenciaRecibida: {
                where: { estado: "POR_ENTREGAR", planillaId: null, tipo: "ENTRANTE" }
            }
        }
    })

    // 2. Correspondencia saliente pendiente (sin agrupar por agencia)
    const pendingSaliente = await prisma.correspondencia.findMany({
        where: { estado: "POR_ENTREGAR", planillaId: null, tipo: "SALIENTE" }
    })

    // 3. Planillas recientes ENTRANTE
    const recentPlanillasEntrante = await prisma.planilla.findMany({
        where: { tipo: "ENTRANTE" },
        orderBy: { fechaGeneracion: "desc" },
        take: 20,
        include: { agencia: true, correspondencias: true }
    })

    // 4. Planillas recientes SALIENTE
    const recentPlanillasSaliente = await prisma.planilla.findMany({
        where: { tipo: "SALIENTE" },
        orderBy: { fechaGeneracion: "desc" },
        take: 20,
        include: { agencia: true, correspondencias: true }
    })

    const agenciesWithPendingEntrante = agenciesEntrante.filter(a => a.correspondenciaRecibida.length > 0)

    return (
        <PlanillasClient 
            agenciesWithPendingEntrante={agenciesWithPendingEntrante}
            pendingSalienteCount={pendingSaliente.length}
            recentPlanillasEntrante={recentPlanillasEntrante}
            recentPlanillasSaliente={recentPlanillasSaliente}
        />
    )
}
