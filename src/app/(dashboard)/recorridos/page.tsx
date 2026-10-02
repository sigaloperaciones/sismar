import { prisma } from "@/lib/prisma"
import RecorridosClient from "./RecorridoList"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Route, Calendar } from "lucide-react"
import AccessDenied from "@/components/AccessDenied"
import { can, requirePagePermission } from "@/lib/auth-guard"
import { PERMISOS } from "@/lib/permissions-catalog"
import { correspondenciaWhere, planillaWhere } from "@/lib/tenancy"

export default async function RecorridosPage() {
    // H-003 / C-007 (M-01): permiso explícito del módulo.
    const auth = await requirePagePermission(PERMISOS.RECORRIDOS_VER)
    if (!auth.ok) return <AccessDenied permiso={auth.permiso} />
    const ctx = auth.ctx
    const canManage = await can(ctx, PERMISOS.RECORRIDOS_GESTIONAR)

    // H-003 / C-002 (A-01): una AGENCIA solo ve sus planillas dentro del recorrido.
    const tenancyP = planillaWhere(ctx)
    const tenancyC = correspondenciaWhere(ctx)

    // Recorrido activo (INICIADO)
    const recorridoActivoDB = await prisma.recorrido.findFirst({
        where: { estado: "INICIADO" },
        orderBy: { fecha: "desc" },
        include: {
            planillas: {
                where: { planilla: tenancyP },
                include: {
                    planilla: {
                        include: {
                            agencia: true,
                            correspondencias: { where: tenancyC },
                        }
                    }
                }
            }
        }
    })

    // Contar planillas abiertas y cerradas (dentro del alcance)
    const [planillasAbiertas, planillasCerradas] = await Promise.all([
        prisma.planilla.count({ where: { AND: [tenancyP, { estado: "GENERADA", tipo: "ENTRANTE" }] } }),
        prisma.planilla.count({ where: { AND: [tenancyP, { estado: "CERRADA", tipo: "ENTRANTE" }] } }),
    ])

    // Transformar datos del recorrido activo para el cliente
    let recorridoActivo = null
    if (recorridoActivoDB) {
        // Agrupar planillas por agencia
        const agenciasMap = new Map<number, {
            id: number
            name: string
            planillas: Array<{
                id: number
                estado: string
                correspondencias: Array<{
                    id: number
                    asunto: string
                    remitenteNombre: string | null
                    destinatarioNombre: string | null
                    empresaMensajeria: string | null
                    estado: string
                    importancia: string
                }>
            }>
        }>()

        for (const rp of recorridoActivoDB.planillas) {
            const agenciaId = rp.planilla.agenciaId
            if (agenciaId == null) continue // Solo planillas entrantes (con agencia) en recorridos
            if (!agenciasMap.has(agenciaId)) {
                agenciasMap.set(agenciaId, {
                    id: agenciaId,
                    name: rp.planilla.agencia?.name ?? "Sin agencia",
                    planillas: []
                })
            }
            agenciasMap.get(agenciaId)!.planillas.push({
                id: rp.planilla.id,
                estado: rp.planilla.estado,
                correspondencias: rp.planilla.correspondencias.map(c => ({
                    id: c.id,
                    asunto: c.asunto,
                    remitenteNombre: c.remitenteNombre,
                    destinatarioNombre: c.destinatarioNombre,
                    empresaMensajeria: c.empresaMensajeria,
                    estado: c.estado,
                    importancia: c.importancia,
                }))
            })
        }

        const agencias = Array.from(agenciasMap.values()).map(a => ({
            ...a,
            todasProcesadas: a.planillas.every(p => p.estado === "PROCESADA")
        }))

        recorridoActivo = {
            id: recorridoActivoDB.id,
            fecha: recorridoActivoDB.fecha,
            tipo: recorridoActivoDB.tipo,
            estado: recorridoActivoDB.estado,
            agencias,
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                        <Route className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Recorridos</h1>
                        <p className="text-sm text-gray-500">Gestione los recorridos de entrega de correspondencia</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2 shadow-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</span>
                </div>
            </div>

            <RecorridosClient
                recorridoActivo={recorridoActivo}
                planillasAbiertas={planillasAbiertas}
                planillasCerradas={planillasCerradas}
                canManage={canManage}
            />
        </div>
    )
}
