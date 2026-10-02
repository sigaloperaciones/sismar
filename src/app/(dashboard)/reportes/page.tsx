import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { BarChart3, Clock, CheckCircle2, Filter } from "lucide-react"
import ReportFilters from "./ReportFilters"
import ReportView from "./ReportView"
import AccessDenied from "@/components/AccessDenied"
import { requirePagePermission } from "@/lib/auth-guard"
import { PERMISOS } from "@/lib/permissions-catalog"
import { agenciaWhere, canAccessAgencia, correspondenciaWhere } from "@/lib/tenancy"
import { asEnum, EstadoCorrespondencia, Importancia, TipoCorrespondencia } from "@/lib/enums"

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
    // H-003 / C-007 (M-01): el módulo exige permiso explícito.
    const auth = await requirePagePermission(PERMISOS.REPORTES_VER)
    if (!auth.ok) return <AccessDenied permiso={auth.permiso} />
    const ctx = auth.ctx

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

    // H-003 / C-002 (A-01): tenencia obligatoria; los filtros del usuario se
    // aplican DENTRO de su alcance y los valores se validan contra los enums (B-02).
    const tenancy = correspondenciaWhere(ctx)
    const filters: Prisma.CorrespondenciaWhereInput = {}

    const estado = asEnum(EstadoCorrespondencia, statusFilter)
    if (estado) filters.estado = estado
    const tipo = asEnum(TipoCorrespondencia, tipoFilter)
    if (tipo) filters.tipo = tipo
    const imp = asEnum(Importancia, importancia)
    if (imp) filters.importancia = imp

    if (agenciaId && agenciaId !== "ALL") {
        const n = parseInt(agenciaId)
        if (!isNaN(n) && canAccessAgencia(ctx, n)) filters.agenciaId = n
    }
    if (necesitaRespuesta && necesitaRespuesta !== "ALL") filters.necesitaRespuesta = necesitaRespuesta === "true"
    if (empresaMensajeria && empresaMensajeria !== "ALL") filters.empresaMensajeria = empresaMensajeria.slice(0, 120)

    const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
    if (isDate(fechaInicio) || isDate(fechaFin)) {
        filters.fechaRecepcion = {}
        if (isDate(fechaInicio)) filters.fechaRecepcion.gte = new Date(`${fechaInicio}T00:00:00.000Z`)
        if (isDate(fechaFin)) filters.fechaRecepcion.lte = new Date(`${fechaFin}T23:59:59.999Z`)
    }

    const searchTerm = search?.trim().slice(0, 100)
    if (searchTerm) {
        filters.OR = [
            { remitenteNombre: { contains: searchTerm } },
            { destinatarioNombre: { contains: searchTerm } },
            { asunto: { contains: searchTerm } },
            { observacionAgencia: { contains: searchTerm } },
            { observacionDevolucion: { contains: searchTerm } }
        ]
    }

    const whereClause: Prisma.CorrespondenciaWhereInput = { AND: [tenancy, filters] }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [items, totalPendientes, totalHoy, totalEntregadas, agencias, empresas] = await Promise.all([
        prisma.correspondencia.findMany({
            where: whereClause,
            orderBy: { fechaRecepcion: "desc" },
            take: 100,
            include: { agencia: true },
        }),
        prisma.correspondencia.count({ where: { AND: [tenancy, { estado: "POR_ENTREGAR" }] } }),
        prisma.correspondencia.count({ where: { AND: [tenancy, { createdAt: { gte: today } }] } }),
        prisma.correspondencia.count({ where: { AND: [tenancy, { estado: "ENTREGADA" }] } }),
        prisma.agencia.findMany({ where: agenciaWhere(ctx), orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })
    ])

    // Build human-readable filters for CSV export
    const activeFilters: string[] = []
    if (estado) {
        activeFilters.push(`Estado: ${estado === "POR_ENTREGAR" ? "Pendiente" : estado === "ENTREGADA" ? "Entregada" : "Devuelta"}`)
    }
    if (tipo) {
        activeFilters.push(`Tipo: ${tipo}`)
    }
    if (isDate(fechaInicio)) activeFilters.push(`Desde: ${fechaInicio}`)
    if (isDate(fechaFin)) activeFilters.push(`Hasta: ${fechaFin}`)
    if (filters.agenciaId) {
        const ag = agencias.find(a => a.id === filters.agenciaId)
        if (ag) activeFilters.push(`Agencia: ${ag.name}`)
    }
    if (imp) {
        activeFilters.push(`Importancia: ${imp}`)
    }
    if (necesitaRespuesta && necesitaRespuesta !== "ALL") {
        activeFilters.push(`Requiere Respuesta: ${necesitaRespuesta === "true" ? "Sí" : "No"}`)
    }
    if (empresaMensajeria && empresaMensajeria !== "ALL") {
        activeFilters.push(`Empresa: ${empresaMensajeria}`)
    }
    if (searchTerm) {
        activeFilters.push(`Búsqueda: "${searchTerm}"`)
    }
    if (activeFilters.length === 0) {
        activeFilters.push("Sin filtros (Últimos 100 registros)")
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reportes y Consultas</h1>
                    <p className="text-sm text-gray-500">
                        {ctx.role === "AGENCIA" ? "Historial y estado de la correspondencia de su agencia" : "Historial y estado de toda la correspondencia"}
                    </p>
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
                <ReportView items={items} activeFilters={activeFilters} />
            </div>
        </div>
    )
}
