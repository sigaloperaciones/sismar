"use client"

import { useState, useTransition } from "react"
import { aprobarCorrespondenciaAction, devolverCorrespondenciaAction } from "@/app/actions/recorridos"
import { processPlanillaAction } from "@/app/actions/panillas"
import {
    CheckCircle, XCircle, RotateCcw, AlertTriangle, Package,
    CheckCircle2, Clock, FileText, ChevronDown, ChevronUp, Paperclip, Hash
} from "lucide-react"

interface AnexoDetalle {
    identificador: string
}

interface Anexo {
    id: number
    cantidad: number
    tipoAnexo: { name: string }
    detalles: AnexoDetalle[]
}

interface Correspondencia {
    id: number
    asunto: string
    remitenteNombre: string | null
    destinatarioNombre: string | null
    empresaMensajeria: string | null
    remitenteCiudad: string | null
    importancia: string
    estado: string
    consecutive: string | null
    anexos?: Anexo[]
}

interface Planilla {
    id: number
    estado: string
    correspondencias: Correspondencia[]
}

export default function MiCorrespondenciaClient({ planillas }: { planillas: Planilla[] }) {
    const [expandedPlanilla, setExpandedPlanilla] = useState<number | null>(planillas[0]?.id ?? null)
    const [procesando, startTransition] = useTransition()
    const [errors, setErrors] = useState<Record<string, string>>({})

    const [localPlanillas, setLocalPlanillas] = useState(planillas)

    function updateCorrespondenciaEstado(planillaId: number, corrId: number, nuevoEstado: string) {
        setLocalPlanillas(prev => prev.map(p => {
            if (p.id !== planillaId) return p
            return {
                ...p,
                correspondencias: p.correspondencias.map(c =>
                    c.id === corrId ? { ...c, estado: nuevoEstado } : c
                )
            }
        }))
    }

    function handleProcesarPlanilla(planillaId: number) {
        if (!confirm("¿Marcar esta planilla como PROCESADA? Esta acción no se puede deshacer.")) return
        startTransition(async () => {
            const result = await processPlanillaAction(planillaId)
            if (result.error) {
                setErrors(prev => ({ ...prev, [`planilla-${planillaId}`]: result.error! }))
            } else {
                setLocalPlanillas(prev => prev.map(p =>
                    p.id === planillaId ? { ...p, estado: "PROCESADA" } : p
                ))
            }
        })
    }

    if (localPlanillas.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <p className="font-semibold text-gray-700">Sin correspondencia pendiente</p>
                <p className="text-sm text-gray-400 mt-1">No tiene planillas activas en el recorrido actual</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {localPlanillas.map(planilla => {
                const isExpanded = expandedPlanilla === planilla.id
                const totalDocs = planilla.correspondencias.length
                const aprobadas = planilla.correspondencias.filter(c => c.estado === "ENTREGADA").length
                const devueltas = planilla.correspondencias.filter(c => c.estado === "DEVUELTA").length
                const pendientes = planilla.correspondencias.filter(c => c.estado === "POR_ENTREGAR").length
                const puedeProcesar = pendientes === 0 && planilla.estado === "CERRADA"

                return (
                    <div key={planilla.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Header planilla */}
                        <button
                            onClick={() => setExpandedPlanilla(isExpanded ? null : planilla.id)}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                planilla.estado === "PROCESADA" ? "bg-green-100" :
                                pendientes === 0 ? "bg-blue-50" : "bg-amber-50"
                            }`}>
                                {planilla.estado === "PROCESADA"
                                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    : pendientes === 0
                                    ? <CheckCircle className="w-5 h-5 text-blue-500" />
                                    : <Clock className="w-5 h-5 text-amber-500" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800">
                                    Planilla #{planilla.id}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {totalDocs} doc{totalDocs !== 1 ? "s" : ""} ·{" "}
                                    <span className="text-green-600 font-medium">{aprobadas} aprobadas</span> ·{" "}
                                    <span className="text-red-500 font-medium">{devueltas} devueltas</span> ·{" "}
                                    <span className="text-amber-600 font-medium">{pendientes} pendientes</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    planilla.estado === "PROCESADA" ? "bg-green-100 text-green-700" :
                                    "bg-blue-100 text-blue-700"
                                }`}>
                                    {planilla.estado === "PROCESADA" ? "Procesada" : "En Recorrido"}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                        </button>

                        {/* Detalle de correspondencia */}
                        {isExpanded && (
                            <div className="border-t border-gray-100">
                                <div className="divide-y divide-gray-50">
                                    {planilla.correspondencias.map(c => (
                                        <CorrespondenciaItem
                                            key={c.id}
                                            correspondencia={c}
                                            planillaEstado={planilla.estado}
                                            onAprobada={() => updateCorrespondenciaEstado(planilla.id, c.id, "ENTREGADA")}
                                            onDevuelta={() => updateCorrespondenciaEstado(planilla.id, c.id, "DEVUELTA")}
                                        />
                                    ))}
                                </div>

                                {/* Botón procesar planilla */}
                                {planilla.estado !== "PROCESADA" && (
                                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                                        {errors[`planilla-${planilla.id}`] && (
                                            <p className="text-red-600 text-sm mb-3">{errors[`planilla-${planilla.id}`]}</p>
                                        )}
                                        {!puedeProcesar && pendientes > 0 && (
                                            <p className="text-amber-700 text-sm mb-3 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                Aún quedan {pendientes} documento{pendientes !== 1 ? "s" : ""} sin revisar
                                            </p>
                                        )}
                                        <button
                                            onClick={() => handleProcesarPlanilla(planilla.id)}
                                            disabled={procesando || !puedeProcesar}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                                        >
                                            {procesando ? (
                                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                            ) : <CheckCircle2 className="w-4 h-4" />}
                                            Marcar Planilla como Procesada
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── Item de correspondencia individual ─────────────────────────────────────────
function CorrespondenciaItem({
    correspondencia: c,
    planillaEstado,
    onAprobada,
    onDevuelta
}: {
    correspondencia: Correspondencia
    planillaEstado: string
    onAprobada: () => void
    onDevuelta: () => void
}) {
    const [estado, setEstado] = useState(c.estado)
    const [showRetorno, setShowRetorno] = useState(false)
    const [observacion, setObservacion] = useState("")
    const [isPending, startTransition] = useTransition()
    const [err, setErr] = useState("")

    const isProcessed = planillaEstado === "PROCESADA"

    function handleAprobar() {
        startTransition(async () => {
            const result = await aprobarCorrespondenciaAction(c.id)
            if (result.error) { setErr(result.error); return }
            setEstado("ENTREGADA")
            onAprobada()
        })
    }

    function handleDevolver() {
        if (!observacion.trim()) { setErr("Ingrese una observación"); return }
        startTransition(async () => {
            const result = await devolverCorrespondenciaAction(c.id, observacion.trim())
            if (result.error) { setErr(result.error); return }
            setEstado("DEVUELTA")
            setShowRetorno(false)
            onDevuelta()
        })
    }

    return (
        <div className={`px-5 py-4 ${
            estado === "ENTREGADA" ? "bg-green-50/40" :
            estado === "DEVUELTA" ? "bg-red-50/40" : ""
        }`}>
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{c.asunto}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {c.consecutive && (
                            <span className="text-[10px] font-mono font-semibold text-gray-500 flex items-center gap-0.5 bg-gray-100 px-1.5 py-0.5 rounded">
                                <Hash className="w-3 h-3" />{c.consecutive}
                            </span>
                        )}
                        {c.remitenteNombre && (
                            <span className="text-xs text-gray-500">De: {c.remitenteNombre}</span>
                        )}
                        {c.empresaMensajeria && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Package className="w-3 h-3" />{c.empresaMensajeria}
                            </span>
                        )}
                        {c.importancia === "ALTA" && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-md">
                                Alta importancia
                            </span>
                        )}
                    </div>

                    {/* Req. cliente #1: anexos y sus identificadores/consecutivos */}
                    {c.anexos && c.anexos.length > 0 && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Paperclip className="w-3 h-3" /> Anexos ({c.anexos.length})
                            </p>
                            <ul className="space-y-1">
                                {c.anexos.map((a) => (
                                    <li key={a.id} className="text-xs text-gray-700">
                                        <span className="font-semibold">{a.cantidad}</span> {a.tipoAnexo.name}
                                        {a.detalles && a.detalles.length > 0 && (
                                            <div className="text-[10px] text-gray-500 ml-2 mt-0.5 border-l border-gray-200 pl-2 break-words">
                                                {a.detalles.map((d) => d.identificador).join(", ")}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
                </div>
                <div className="shrink-0">
                    {estado === "ENTREGADA" && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Aprobada
                        </span>
                    )}
                    {estado === "DEVUELTA" && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                            <XCircle className="w-3 h-3" /> Devuelta
                        </span>
                    )}
                </div>
            </div>

            {/* Acciones */}
            {estado === "POR_ENTREGAR" && !isProcessed && (
                <div className="mt-3 ml-11">
                    {!showRetorno ? (
                        <div className="flex gap-2">
                            <button
                                onClick={handleAprobar}
                                disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Aprobar
                            </button>
                            <button
                                onClick={() => setShowRetorno(true)}
                                disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                Devolver
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                placeholder="Motivo de devolución..."
                                value={observacion}
                                onChange={e => setObservacion(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-red-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowRetorno(false); setObservacion(""); setErr("") }}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                                >
                                    <RotateCcw className="w-3 h-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleDevolver}
                                    disabled={!observacion.trim() || isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-semibold rounded-lg"
                                >
                                    <XCircle className="w-3 h-3" /> Confirmar Devolución
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
