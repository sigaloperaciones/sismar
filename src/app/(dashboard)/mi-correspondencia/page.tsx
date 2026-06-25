import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Inbox, Route } from "lucide-react"
import MiCorrespondenciaClient from "./MiCorrespondenciaClient"

export default async function MiCorrespondenciaPage() {
    const session = await getSession()
    if (!session) redirect("/login")

    // Solo usuarios de tipo AGENCIA
    if (session.role !== "AGENCIA" && session.role !== "ADMIN") {
        redirect("/")
    }

    // Buscar agencia del usuario
    const usuario = await prisma.usuario.findUnique({
        where: { id: session.userId as number },
        include: { agencia: true }
    })

    if (!usuario?.agencia) {
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
                        <p className="text-sm text-gray-500">{usuario.agencia.name}</p>
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

    // Buscar planillas de la agencia en el recorrido activo
    const planillas = await prisma.planilla.findMany({
        where: {
            agenciaId: usuario.agencia.id,
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
                        {usuario.agencia.name} · Recorrido #{recorridoActivo.id}
                    </p>
                </div>
            </div>

            <MiCorrespondenciaClient planillas={planillas} />
        </div>
    )
}
