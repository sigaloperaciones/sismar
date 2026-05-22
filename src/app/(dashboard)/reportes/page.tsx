import { prisma } from "@/lib/prisma"
import { BarChart3, Clock, CheckCircle2, Filter } from "lucide-react"
import ReportFilters from "./ReportFilters"
import ReportView from "./ReportView"

export const revalidate = 0 // Desactivar cache para que los filtros funcionen en tiempo real

export default async function ReportesPage({
    searchParams,
}: {
    searchParams: Promise<{ 
        status?: string; 
        tipo?: string;
        fechaInicio?: string;
        fechaFin?: string;
        agenciaId?: string;
        search?: string;
        importancia?: string;
        necesitaRespuesta?: string;
        empresaMensajeria?: string;
    }>
}) {
    const { 
        status: statusFilter, 
        tipo: tipoFilter,
        fechaInicio,
        fechaFin,
        agenciaId,
        search,
        importancia,
        necesitaRespuesta,
        empresaMensajeria
    } = await searchParams

    const whereClause: Record<string, any> = {}
    if (statusFilter && statusFilter !== "ALL") whereClause.estado = statusFilter
    if (tipoFilter && tipoFilter !== "ALL") whereClause.tipo = tipoFilter
    if (agenciaId && agenciaId !== "ALL") whereClause.agenciaId = parseInt(agenciaId)
    if (importancia && importancia !== "ALL") whereClause.importancia = importancia
    if (necesitaRespuesta && necesitaRespuesta !== "ALL") whereClause.necesitaRespuesta = necesitaRespuesta === "true"
    if (empresaMensajeria && empresaMensajeria !== "ALL") whereClause.empresaMensajeria = empresaMensajeria
    
    if (fechaInicio || fechaFin) {
        whereClause.fechaRecepcion = {}
        if (fechaInicio) whereClause.fechaRecepcion.gte = new Date(`${fechaInicio}T00:00:00.000Z`)
        if (fechaFin) whereClause.fechaRecepcion.lte = new Date(`${fechaFin}T23:59:59.999Z`)
    }

    if (search) {
        whereClause.OR = [
            { remitenteNombre: { contains: search } },
            { destinatarioNombre: { contains: search } },
            { asunto: { contains: search } },
            { observacionAgencia: { contains: search } },
            { observacionDevolucion: { contains: search } }
        ]
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [items, totalPendientes, totalHoy, totalEntregadas, agencias, empresas] = await Promise.all([
        prisma.correspondencia.findMany({
            where: whereClause,
            orderBy: { fechaRecepcion: "desc" },
            take: 100,
            include: { agencia: true },
        }),
        prisma.correspondencia.count({ where: { estado: "POR_ENTREGAR" } }),
        prisma.correspondencia.count({ where: { createdAt: { gte: today } } }),
        prisma.correspondencia.count({ where: { estado: "ENTREGADA" } }),
        prisma.agencia.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })
    ])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reportes y Consultas</h1>
                    <p className="text-sm text-gray-500">Historial y estado de toda la correspondencia</p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registradas Hoy</p>
                        <p className="text-3xl font-bold text-gray-900 mt-0.5">{totalHoy}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pendientes Entrega</p>
                        <p className="text-3xl font-bold text-amber-600 mt-0.5">{totalPendientes}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Entregadas</p>
                        <p className="text-3xl font-bold text-green-600 mt-0.5">{totalEntregadas}</p>
                    </div>
                </div>
            </div>

            {/* Filtros + Tabla/Gráfica */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">Filtros de Búsqueda</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white border border-gray-150 px-2.5 py-1 rounded-full font-semibold">
                        {items.length} resultado{items.length !== 1 ? "s" : ""}
                    </span>
                </div>
                
                <ReportFilters agencias={agencias} empresas={empresas} />

                {/* Vista dinámica */}
                <ReportView items={items} />
            </div>
        </div>
    )
}
