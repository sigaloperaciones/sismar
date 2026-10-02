import { prisma } from "@/lib/prisma"
import { Inbox, Route } from "lucide-react"
import MiCorrespondenciaClient from "./MiCorrespondenciaClient"
import AccessDenied from "@/components/AccessDenied"
import { requirePagePermission } from "@/lib/auth-guard"
import { PERMISOS } from "@/lib/permissions-catalog"

export default async function MiCorrespondenciaPage() {
    // H-003 / C-007: recibir correspondencia (aprobar/devolver/procesar) exige
    // el permiso `correspondencia.recibir`. La agencia se lee de BD (ctx fresco).
    const auth = await requirePagePermission(PERMISOS.RECIBIR)
    if (!auth.ok) return <AccessDenied permiso={auth.permiso} />
    const ctx = auth.ctx

    const agencia = ctx.agenciaId
        ? await prisma.agencia.findUnique({ where: { id: ctx.agenciaId }, select: { id: true, name: true } })
        : null

    if (!agencia) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                        <Inbox className="w-5 h-5" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Mis Planillas</h1>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
                    Su usuario no tiene una agencia asignada. Contacte al administrador.
                </div>
            </div>
        )
    }

    // Buscar recorrido activo
    const recorridoActivo = await prisma.recorrido.findFirst({
        where: { estado: "INICIADO" }
    })

    if (!recorridoActivo) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                        <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mis Planillas</h1>
                        <p className="text-sm text-gray-500">{agencia.name}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <Route className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-gray-600">Sin recorrido activo</p>
                    <p className="text-sm text-gray-400 mt-1">No hay un recorrido en curso en este momento</p>
                </div>
            </div>
        )
    }

    // Planillas de la agencia del usuario en el recorrido activo (tenencia por agenciaId)
    const planillas = await prisma.planilla.findMany({
        where: {
            agenciaId: agencia.id,
            recorridoPlanillas: {
                some: { recorridoId: recorridoActivo.id }
            }
        },
        include: {
            correspondencias: {
                select: {
                    id: true,
                    asunto: true,
                    remitenteNombre: true,
                    destinatarioNombre: true,
                    empresaMensajeria: true,
                    remitenteCiudad: true,
                    importancia: true,
                    estado: true,
                    consecutive: true,
                    // Req. cliente #1: los anexos y sus identificadores (p.ej. varias
                    // facturas) deben poder visualizarse en la planilla de recibido.
                    anexos: {
                        select: {
                            id: true,
                            cantidad: true,
                            tipoAnexo: { select: { name: true } },
                            detalles: { select: { identificador: true } },
                        },
                    },
                }
            }
        },
        orderBy: { id: "asc" }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Inbox className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mis Planillas</h1>
                    <p className="text-sm text-gray-500">
                        {agencia.name} · Recorrido #{recorridoActivo.id}
                    </p>
                </div>
            </div>

            <MiCorrespondenciaClient planillas={planillas} />
        </div>
    )
}
