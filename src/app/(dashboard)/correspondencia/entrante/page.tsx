import { prisma } from "@/lib/prisma"
import IncomingMailForm from "@/components/forms/IncomingMailForm"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowDownLeft, Clock } from "lucide-react"

export default async function IncomingMailPage() {
    const agencias = await prisma.agencia.findMany({ select: { id: true, name: true } })
    const tiposAnexo = await prisma.tipoAnexo.findMany({ select: { id: true, name: true } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })

    const recentMail = await prisma.correspondencia.findMany({
        where: { estado: "POR_ENTREGAR" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { agencia: true }
    })

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Correspondencia Entrante</h1>
                    <p className="text-sm text-gray-500">Registre y gestione la correspondencia recibida</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Formulario — ocupa 2 columnas */}
                <div className="xl:col-span-2">
                    <IncomingMailForm agencias={agencias} tiposAnexo={tiposAnexo} ciudades={ciudades} empresas={empresas} />
                </div>

                {/* Panel lateral — pendientes */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <h2 className="font-semibold text-gray-800 text-sm">Pendientes por Entregar</h2>
                            {recentMail.length > 0 && (
                                <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    {recentMail.length}
                                </span>
                            )}
                        </div>

                        {recentMail.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm">Sin pendientes</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {recentMail.map((mail) => (
                                    <div key={mail.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 truncate">
                                                    {mail.remitenteNombre}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                                    {mail.empresaMensajeria}
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1 font-medium">
                                                    → {mail.agencia.name}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {mail.importancia === "ALTA" && (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                        Alta
                                                    </Badge>
                                                )}
                                                <span className="text-[11px] text-gray-400">
                                                    {format(mail.fechaRecepcion, "dd/MM HH:mm", { locale: es })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
