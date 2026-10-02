"use client"

import { useState } from "react"
import { format, differenceInDays, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { csvCell } from "@/lib/csv"
import { 
    Table, 
    BarChart3, 
    ArrowDownLeft, 
    ArrowUpRight, 
    Clock, 
    CheckCircle2, 
    XCircle,
    Inbox,
    Send,
    Download
} from "lucide-react"
import AsuntoCell from "./AsuntoCell"

interface MailItem {
    id: number
    tipo: string
    estado: string
    fechaRecepcion: Date | string
    agenciaId: number
    agencia: {
        id: number
        name: string
    }
    remitenteNombre: string | null
    destinatarioNombre: string | null
    empresaMensajeria: string | null
    asunto: string
    importancia: string
    necesitaRespuesta: boolean
    observacionAgencia: string | null
    observacionDevolucion: string | null
}

interface ReportViewProps {
    items: MailItem[]
    activeFilters?: string[]
}

export default function ReportView({ items, activeFilters = [] }: ReportViewProps) {
    const [activeTab, setActiveTab] = useState<"table" | "chart">("table")
    const [hoveredData, setHoveredData] = useState<{
        x: number
        y: number
        date: string
        entrante: number
        saliente: number
    } | null>(null)

    // --- Procesamiento de datos para la gráfica ---
    const getChartData = () => {
        if (items.length === 0) return []

        const dateMap: Record<string, { entrante: number; saliente: number }> = {}

        // Encontrar el rango de fechas de los elementos actuales
        let minDate: Date | null = null
        let maxDate: Date | null = null

        items.forEach(item => {
            const date = new Date(item.fechaRecepcion)
            if (!minDate || date < minDate) minDate = date
            if (!maxDate || date > maxDate) maxDate = date

            const dateKey = format(date, "yyyy-MM-dd")
            if (!dateMap[dateKey]) {
                dateMap[dateKey] = { entrante: 0, saliente: 0 }
            }
            if (item.tipo === "ENTRANTE") {
                dateMap[dateKey].entrante++
            } else {
                dateMap[dateKey].saliente++
            }
        })

        if (!minDate || !maxDate) return []

        // Llenar los días intermedios con ceros para crear una línea de tiempo continua
        const chartData = []
        const daysDiff = differenceInDays(maxDate, minDate)
        
        // Limitar la visualización a máximo 30 días para evitar saturación visual
        const startDay = daysDiff > 30 ? addDays(maxDate, -30) : minDate
        let current = startDay

        while (current <= maxDate) {
            const dateKey = format(current, "yyyy-MM-dd")
            const values = dateMap[dateKey] || { entrante: 0, saliente: 0 }
            chartData.push({
                dateKey,
                label: format(current, "dd MMM", { locale: es }),
                fullDate: format(current, "dd 'de' MMMM yyyy", { locale: es }),
                entrante: values.entrante,
                saliente: values.saliente,
                total: values.entrante + values.saliente
            })
            current = addDays(current, 1)
        }

        return chartData
    }

    const chartData = getChartData()
    const maxVal = chartData.reduce((acc, curr) => Math.max(acc, curr.entrante, curr.saliente, 1), 1)

    // --- Exportar a CSV ---
    const exportToCSV = () => {
        if (items.length === 0) return

        const headers = [
            "Fecha",
            "Tipo",
            "Estado",
            "Agencia",
            "Remitente / Destinatario",
            "Empresa de Mensajeria",
            "Asunto",
            "Importancia",
            "Requiere Respuesta",
            "Notas Agencia",
            "Notas Devolución"
        ]

        const csvContent = [
            `"Reporte Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}"`,
            `"Filtros Activos: ${activeFilters.join(" | ")}"`,
            "",
            headers.join(","),
            // R-037: csvCell neutraliza fórmulas (= + - @) y escapa comillas en cada celda
            ...items.map(item => {
                return [
                    csvCell(format(new Date(item.fechaRecepcion), "dd/MM/yyyy HH:mm")),
                    csvCell(item.tipo),
                    csvCell(item.estado === "POR_ENTREGAR" ? "Pendiente" : item.estado === "ENTREGADA" ? "Entregada" : "Devuelta"),
                    csvCell(item.agencia?.name || ""),
                    csvCell(item.remitenteNombre || item.destinatarioNombre || ""),
                    csvCell(item.empresaMensajeria || ""),
                    csvCell(item.asunto),
                    csvCell(item.importancia),
                    csvCell(item.necesitaRespuesta ? "Sí" : "No"),
                    csvCell(item.observacionAgencia || ""),
                    csvCell(item.observacionDevolucion || "")
                ].join(",")
            })
        ].join("\n")

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `reporte-correspondencia-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Configuración del SVG
    const svgWidth = 800
    const svgHeight = 350
    const paddingLeft = 45
    const paddingRight = 20
    const paddingTop = 30
    const paddingBottom = 45
    const chartWidth = svgWidth - paddingLeft - paddingRight
    const chartHeight = svgHeight - paddingTop - paddingBottom

    const gridLines = [0, 0.25, 0.5, 0.75, 1]

    return (
        <div className="space-y-4">
            {/* Selector de vistas */}
            <div className="flex border-b border-gray-100 px-5 bg-white">
                <button
                    onClick={() => setActiveTab("table")}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
                        activeTab === "table"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                >
                    <Table className="w-4 h-4" />
                    Tabla de Datos
                </button>
                <button
                    onClick={() => setActiveTab("chart")}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
                        activeTab === "chart"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Gráfica Diaria
                </button>
                <div className="ml-auto flex items-center pr-2 py-2">
                    <button
                        onClick={exportToCSV}
                        disabled={items.length === 0}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Contenido según la pestaña */}
            {activeTab === "table" ? (
                <div className="overflow-x-auto bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                                <th className="text-left py-3.5 px-5">Fecha</th>
                                <th className="text-left py-3.5 px-5">Tipo</th>
                                <th className="text-left py-3.5 px-5">Estado</th>
                                <th className="text-left py-3.5 px-5">Agencia</th>
                                <th className="text-left py-3.5 px-5 min-w-[200px]">Remitente / Destinatario</th>
                                <th className="text-left py-3.5 px-5 min-w-[150px]">Asunto</th>
                                <th className="text-center py-3.5 px-5">Importancia</th>
                                <th className="text-center py-3.5 px-5">Respuesta</th>
                                <th className="text-left py-3.5 px-5 min-w-[200px]">Notas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <BarChart3 className="w-8 h-8 opacity-30" />
                                            <p>No se encontraron registros con los filtros seleccionados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3.5 px-5 text-gray-500 text-xs whitespace-nowrap">
                                            {format(new Date(item.fechaRecepcion), "dd/MM/yy HH:mm", { locale: es })}
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                                item.tipo === "ENTRANTE"
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "bg-emerald-50 text-emerald-700"
                                            }`}>
                                                {item.tipo === "ENTRANTE"
                                                    ? <ArrowDownLeft className="w-3 h-3" />
                                                    : <ArrowUpRight className="w-3 h-3" />
                                                }
                                                {item.tipo === "ENTRANTE" ? "Entrante" : "Saliente"}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                                item.estado === "POR_ENTREGAR"
                                                    ? "bg-amber-50 text-amber-700"
                                                    : item.estado === "ENTREGADA"
                                                    ? "bg-green-50 text-green-700"
                                                    : "bg-red-50 text-red-700"
                                            }`}>
                                                {item.estado === "POR_ENTREGAR" && <Clock className="w-3 h-3" />}
                                                {item.estado === "ENTREGADA" && <CheckCircle2 className="w-3 h-3" />}
                                                {item.estado === "DEVUELTA" && <XCircle className="w-3 h-3" />}
                                                {item.estado === "POR_ENTREGAR" ? "Pendiente"
                                                    : item.estado === "ENTREGADA" ? "Entregada"
                                                    : "Devuelta"}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-5 font-semibold text-gray-800">
                                            {item.agencia?.name}
                                        </td>
                                        <td className="py-3.5 px-5 max-w-[160px]">
                                            <p className="text-gray-700 text-xs font-semibold truncate">
                                                {item.remitenteNombre || item.destinatarioNombre || "—"}
                                            </p>
                                            {item.empresaMensajeria && (
                                                <p className="text-gray-400 text-[10px] truncate mt-0.5 font-medium flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                    {item.empresaMensajeria}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <AsuntoCell asunto={item.asunto} />
                                        </td>
                                        <td className="py-3.5 px-5 text-center">
                                            {item.importancia === "ALTA" ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded-md border border-red-100">
                                                    Alta
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md">
                                                    Normal
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-5 text-center">
                                            {item.necesitaRespuesta ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md border border-purple-100">
                                                    Sí
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-gray-50 text-gray-400 rounded-md">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-5 text-xs text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                {item.observacionAgencia && (
                                                    <p><span className="font-semibold text-gray-700">Agencia:</span> {item.observacionAgencia}</p>
                                                )}
                                                {item.observacionDevolucion && (
                                                    <p><span className="font-semibold text-red-700">Devolución:</span> {item.observacionDevolucion}</p>
                                                )}
                                                {!item.observacionAgencia && !item.observacionDevolucion && <span className="text-gray-400">—</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                // --- Vista Gráfica ---
                <div className="p-6 bg-white flex flex-col items-center">
                    <div className="w-full max-w-4xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">Actividad de Correspondencia Diaria</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Volumen diario de correspondencia entrante y saliente procesada en el rango seleccionado</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 bg-blue-500 rounded-md shadow-sm"></span>
                                    <span className="text-gray-600">Entrante</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 bg-emerald-500 rounded-md shadow-sm"></span>
                                    <span className="text-gray-600">Saliente</span>
                                </div>
                            </div>
                        </div>

                        {chartData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                                <BarChart3 className="w-12 h-12 mb-3 opacity-25" />
                                <p className="text-sm font-medium">No hay suficientes datos para graficar</p>
                                <p className="text-xs mt-1 text-gray-500">Asegúrese de seleccionar un rango de fechas con registros</p>
                            </div>
                        ) : (
                            <div className="relative w-full overflow-x-auto">
                                <svg
                                    width="100%"
                                    height={svgHeight}
                                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                    className="overflow-visible select-none min-w-[600px]"
                                >
                                    {/* Grid Lines */}
                                    {gridLines.map((percent, idx) => {
                                        const y = paddingTop + chartHeight * (1 - percent)
                                        const labelVal = Math.round(maxVal * percent)
                                        return (
                                            <g key={idx} className="opacity-40">
                                                <line
                                                    x1={paddingLeft}
                                                    y1={y}
                                                    x2={svgWidth - paddingRight}
                                                    y2={y}
                                                    stroke="#e2e8f0"
                                                    strokeWidth={1}
                                                    strokeDasharray={idx === 0 ? "0" : "4 4"}
                                                />
                                                <text
                                                    x={paddingLeft - 8}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    className="fill-gray-400 font-medium text-[10px]"
                                                >
                                                    {labelVal}
                                                </text>
                                            </g>
                                        )
                                    })}

                                    {/* Bars and Interactive Groups */}
                                    {chartData.map((data, idx) => {
                                        const count = chartData.length
                                        const groupWidth = chartWidth / count
                                        const groupX = paddingLeft + idx * groupWidth

                                        const barWidth = Math.max(Math.min(groupWidth * 0.35, 14), 4)
                                        const gap = Math.max(groupWidth * 0.05, 2)

                                        // Altura de barras
                                        const eHeight = (data.entrante / maxVal) * chartHeight
                                        const sHeight = (data.saliente / maxVal) * chartHeight

                                        const eY = paddingTop + chartHeight - eHeight
                                        const sY = paddingTop + chartHeight - sHeight

                                        // Centrar el grupo de barras en la columna
                                        const centerX = groupX + groupWidth / 2
                                        const entranteX = centerX - barWidth - gap / 2
                                        const salienteX = centerX + gap / 2

                                        return (
                                            <g 
                                                key={idx}
                                                className="cursor-pointer group"
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                                                    if (parentRect) {
                                                        setHoveredData({
                                                            x: rect.left - parentRect.left + rect.width / 2,
                                                            y: Math.min(eY, sY) - 50,
                                                            date: data.fullDate,
                                                            entrante: data.entrante,
                                                            saliente: data.saliente
                                                        })
                                                    }
                                                }}
                                                onMouseLeave={() => setHoveredData(null)}
                                            >
                                                {/* Zona interactiva invisible para facilitar hover */}
                                                <rect
                                                    x={groupX}
                                                    y={paddingTop}
                                                    width={groupWidth}
                                                    height={chartHeight}
                                                    fill="transparent"
                                                />

                                                {/* Barra Entrante (Azul) */}
                                                <rect
                                                    x={entranteX}
                                                    y={eY}
                                                    width={barWidth}
                                                    height={Math.max(eHeight, 0)}
                                                    fill="#3b82f6"
                                                    rx={2}
                                                    className="transition-all duration-300 group-hover:fill-blue-600"
                                                />

                                                {/* Barra Saliente (Verde/Esmeralda) */}
                                                <rect
                                                    x={salienteX}
                                                    y={sY}
                                                    width={barWidth}
                                                    height={Math.max(sHeight, 0)}
                                                    fill="#10b981"
                                                    rx={2}
                                                    className="transition-all duration-300 group-hover:fill-emerald-600"
                                                />

                                                {/* Etiqueta Eje X (Fecha) - Mostrar cada X días según saturación */}
                                                {(count < 10 || idx % Math.ceil(count / 10) === 0) && (
                                                    <text
                                                        x={centerX}
                                                        y={paddingTop + chartHeight + 18}
                                                        textAnchor="middle"
                                                        className="fill-gray-500 font-semibold text-[10px] uppercase tracking-wider"
                                                    >
                                                        {data.label}
                                                    </text>
                                                )}
                                            </g>
                                        )
                                    })}

                                    {/* Eje X Línea */}
                                    <line
                                        x1={paddingLeft}
                                        y1={paddingTop + chartHeight}
                                        x2={svgWidth - paddingRight}
                                        y2={paddingTop + chartHeight}
                                        stroke="#cbd5e1"
                                        strokeWidth={1}
                                    />
                                </svg>

                                {/* Tooltip Flotante Premium */}
                                {hoveredData && (
                                    <div
                                        style={{
                                            left: `${hoveredData.x}px`,
                                            top: `${hoveredData.y}px`,
                                            transform: "translateX(-50%)"
                                        }}
                                        className="absolute z-10 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs transition-all pointer-events-none w-48 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                                    >
                                        <p className="font-bold border-b border-slate-800 pb-1.5 mb-1.5 text-[11px] text-slate-300">
                                            {hoveredData.date}
                                        </p>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="flex items-center gap-1 text-slate-400 font-medium"><Inbox className="w-3 h-3 text-blue-400" /> Entrante:</span>
                                                <span className="font-bold text-blue-300">{hoveredData.entrante}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="flex items-center gap-1 text-slate-400 font-medium"><Send className="w-3 h-3 text-emerald-400" /> Saliente:</span>
                                                <span className="font-bold text-emerald-300">{hoveredData.saliente}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-slate-800 pt-1.5 mt-1.5 font-bold">
                                                <span className="text-slate-300">Total:</span>
                                                <span className="text-indigo-400">{hoveredData.entrante + hoveredData.saliente}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
