"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search, Filter, X } from "lucide-react"
import { useState } from "react"

export default function ReportFilters({ 
    agencias,
    empresas
}: { 
    agencias: { id: number, name: string }[],
    empresas: { nombre: string }[]
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [filters, setFilters] = useState({
        status: searchParams.get("status") || "ALL",
        tipo: searchParams.get("tipo") || "ALL",
        fechaInicio: searchParams.get("fechaInicio") || "",
        fechaFin: searchParams.get("fechaFin") || "",
        agenciaId: searchParams.get("agenciaId") || "ALL",
        search: searchParams.get("search") || "",
        importancia: searchParams.get("importancia") || "ALL",
        necesitaRespuesta: searchParams.get("necesitaRespuesta") || "ALL",
        empresaMensajeria: searchParams.get("empresaMensajeria") || "ALL"
    })

    const handleChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const applyFilters = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== "ALL") {
                params.set(key, value)
            }
        })
        router.push(`/reportes?${params.toString()}`)
    }

    const clearFilters = () => {
        setFilters({
            status: "ALL",
            tipo: "ALL",
            fechaInicio: "",
            fechaFin: "",
            agenciaId: "ALL",
            search: "",
            importancia: "ALL",
            necesitaRespuesta: "ALL",
            empresaMensajeria: "ALL"
        })
        router.push(`/reportes`)
    }

    return (
        <form onSubmit={applyFilters} className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Search Text */}
                <div className="col-span-1 md:col-span-3 lg:col-span-4 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar en Remitente, Destinatario, Asunto o Notas..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={filters.search}
                            onChange={(e) => handleChange("search", e.target.value)}
                        />
                    </div>
                </div>

                {/* Fecha Inicio */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Fecha Inicio</label>
                    <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filters.fechaInicio}
                        onChange={(e) => handleChange("fechaInicio", e.target.value)}
                    />
                </div>

                {/* Fecha Fin */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Fecha Fin</label>
                    <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filters.fechaFin}
                        onChange={(e) => handleChange("fechaFin", e.target.value)}
                    />
                </div>

                {/* Agencia */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Agencia</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.agenciaId}
                        onChange={(e) => handleChange("agenciaId", e.target.value)}
                    >
                        <option value="ALL">Todas las agencias</option>
                        {agencias.map(ag => (
                            <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                    </select>
                </div>

                {/* Estado */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Estado</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.status}
                        onChange={(e) => handleChange("status", e.target.value)}
                    >
                        <option value="ALL">Todos los estados</option>
                        <option value="POR_ENTREGAR">Por Entregar</option>
                        <option value="ENTREGADA">Entregadas</option>
                        <option value="DEVUELTA">Devueltas</option>
                    </select>
                </div>

                {/* Tipo */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Tipo</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.tipo}
                        onChange={(e) => handleChange("tipo", e.target.value)}
                    >
                        <option value="ALL">Todos los tipos</option>
                        <option value="ENTRANTE">Entrante</option>
                        <option value="SALIENTE">Saliente</option>
                    </select>
                </div>

                {/* Empresa Mensajería */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Empresa Mensajería</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.empresaMensajeria}
                        onChange={(e) => handleChange("empresaMensajeria", e.target.value)}
                    >
                        <option value="ALL">Todas las empresas</option>
                        {empresas.map(emp => (
                            <option key={emp.nombre} value={emp.nombre}>{emp.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Importancia */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Importancia</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.importancia}
                        onChange={(e) => handleChange("importancia", e.target.value)}
                    >
                        <option value="ALL">Todas</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ALTA">Alta</option>
                    </select>
                </div>

                {/* Necesita Respuesta */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Respuesta</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={filters.necesitaRespuesta}
                        onChange={(e) => handleChange("necesitaRespuesta", e.target.value)}
                    >
                        <option value="ALL">Cualquiera</option>
                        <option value="true">Sí necesita</option>
                        <option value="false">No necesita</option>
                    </select>
                </div>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                    <Filter className="w-4 h-4" />
                    Aplicar Filtros
                </button>
                <button
                    type="button"
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                    <X className="w-4 h-4" />
                    Limpiar
                </button>
            </div>
        </form>
    )
}
