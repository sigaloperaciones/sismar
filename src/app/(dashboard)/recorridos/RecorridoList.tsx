"use client"

import { useState, useTransition } from "react"
import { createRecorridoAction, anularRecorridoAction } from "@/app/actions/recorridos"
import {
    Truck, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
    Route, Clock, Package, X
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Correspondencia {
    id: number
    asunto: string
    remitenteNombre: string | null
    destinatarioNombre: string | null
    empresaMensajeria: string | null
    estado: string
    importancia: string
}

interface Planilla {
    id: number
    estado: string
    correspondencias: Correspondencia[]
}

interface AgenciaEnRecorrido {
    id: number
    name: string
    planillas: Planilla[]
    todasProcesadas: boolean
}

interface RecorridoActivo {
    id: number
    fecha: Date
    tipo: string
    estado: string
    agencias: AgenciaEnRecorrido[]
}

interface RecorridosClientProps {
    recorridoActivo: RecorridoActivo | null
    planillasAbiertas: number
    planillasCerradas: number
    /** H-003: iniciar/anular/agregar exige `recorridos.gestionar` (re-verificado en servidor). */
    canManage?: boolean
}

export default function RecorridosClient({ recorridoActivo, planillasAbiertas, planillasCerradas, canManage = false }: RecorridosClientProps) {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const [tipo, setTipo] = useState("AM")
    const [notas, setNotas] = useState("")
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [expandedAgencia, setExpandedAgencia] = useState<number | null>(null)

    function handleCreateClick() {
        if (planillasCerradas === 0 && !recorridoActivo) {
            setError("No hay planillas cerradas para iniciar un recorrido")
            return
        }
        if (planillasAbiertas > 0) {
            setShowWarning(true)
        } else {
            setShowCreateModal(true)
        }
    }

    function handleConfirmWarning() {
        setShowWarning(false)
        setShowCreateModal(true)
    }

    function handleCreate() {
        setError("")
        startTransition(async () => {
            const result = await createRecorridoAction(tipo, notas)
            if (result.error) {
                setError(result.error)
            } else {
                setShowCreateModal(false)
                window.location.reload()
            }
        })
    }

    function handleAnular(id: number) {
        if (!confirm("¿Está seguro de anular este recorrido?")) return
        startTransition(async () => {
            const result = await anularRecorridoAction(id)
            if (result.error) setError(result.error)
            else window.location.reload()
        })
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                    <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Recorrido Activo */}
            {recorridoActivo ? (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 bg-blue-50 border-b border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                                    <Truck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-blue-900">
                                        Recorrido #{recorridoActivo.id} — {recorridoActivo.tipo}
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        {format(new Date(recorridoActivo.fecha), "EEEE d 'de' MMMM, yyyy · HH:mm", { locale: es })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                                    recorridoActivo.estado === "INICIADO" ? "bg-blue-100 text-blue-700" :
                                    recorridoActivo.estado === "TERMINADO" ? "bg-green-100 text-green-700" :
                                    "bg-red-100 text-red-700"
                                }`}>
                                    {recorridoActivo.estado === "INICIADO" ? "En Curso" :
                                     recorridoActivo.estado === "TERMINADO" ? "Terminado" : "Anulado"}
                                </span>
                                {canManage && recorridoActivo.estado === "INICIADO" && (
                                    <button
                                        onClick={() => handleAnular(recorridoActivo.id)}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Anular
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Resumen por agencia */}
                        <div className="divide-y divide-gray-50">
                            {recorridoActivo.agencias.map(agencia => {
                                const isExpanded = expandedAgencia === agencia.id
                                const totalDocs = agencia.planillas.reduce(
                                    (sum, p) => sum + p.correspondencias.length, 0
                                )
                                const procesadas = agencia.planillas.filter(p => p.estado === "PROCESADA").length

                                return (
                                    <div key={agencia.id}>
                                        <button
                                            onClick={() => setExpandedAgencia(isExpanded ? null : agencia.id)}
                                            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                agencia.todasProcesadas ? "bg-green-100" : "bg-amber-50"
                                            }`}>
                                                {agencia.todasProcesadas
                                                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                    : <Clock className="w-5 h-5 text-amber-500" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800">{agencia.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {agencia.planillas.length} planilla{agencia.planillas.length !== 1 ? "s" : ""} ·{" "}
                                                    {totalDocs} doc{totalDocs !== 1 ? "s" : ""} ·{" "}
                                                    {procesadas}/{agencia.planillas.length} procesada{agencia.planillas.length !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                                    agencia.todasProcesadas
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-amber-100 text-amber-700"
                                                }`}>
                                                    {agencia.todasProcesadas ? "✓ Procesada" : "Pendiente"}
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Detalle de planillas */}
                                        {isExpanded && (
                                            <div className="px-6 pb-4 bg-gray-50 space-y-3">
                                                {agencia.planillas.map(planilla => (
                                                    <div key={planilla.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                                                            <Package className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm font-semibold text-gray-700">
                                                                Planilla #{planilla.id}
                                                            </span>
                                                            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                planilla.estado === "PROCESADA" ? "bg-green-100 text-green-700" :
                                                                planilla.estado === "CERRADA" ? "bg-blue-100 text-blue-700" :
                                                                "bg-amber-100 text-amber-700"
                                                            }`}>
                                                                {planilla.estado === "PROCESADA" ? "Procesada" :
                                                                 planilla.estado === "CERRADA" ? "Cerrada" : "Generada"}
                                                            </span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {planilla.correspondencias.map(c => (
                                                                <div key={c.id} className="flex items-center gap-3 px-4 py-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm text-gray-700 truncate">{c.asunto}</p>
                                                                        <p className="text-xs text-gray-400">
                                                                            {c.remitenteNombre || c.destinatarioNombre}
                                                                            {c.empresaMensajeria && ` · ${c.empresaMensajeria}`}
                                                                        </p>
                                                                    </div>
                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                                                        c.estado === "ENTREGADA" ? "bg-green-100 text-green-700" :
                                                                        c.estado === "DEVUELTA" ? "bg-red-100 text-red-700" :
                                                                        "bg-gray-100 text-gray-600"
                                                                    }`}>
                                                                        {c.estado === "ENTREGADA" ? "Entregada" :
                                                                         c.estado === "DEVUELTA" ? "Devuelta" : "Pendiente"}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Botón agregar planillas al recorrido activo */}
                    {canManage && recorridoActivo.estado === "INICIADO" && planillasCerradas > 0 && (
                        <button
                            onClick={handleCreateClick}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-semibold rounded-xl transition-colors"
                        >
                            <Route className="w-4 h-4" />
                            Agregar {planillasCerradas} planilla{planillasCerradas !== 1 ? "s" : ""} cerrada{planillasCerradas !== 1 ? "s" : ""} al recorrido
                        </button>
                    )}
                </div>
            ) : (
                /* Sin recorrido activo */
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
                        <Truck className="w-8 h-8 text-orange-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-700">Sin recorrido activo</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {planillasCerradas > 0
                                ? `Hay ${planillasCerradas} planilla${planillasCerradas !== 1 ? "s" : ""} cerrada${planillasCerradas !== 1 ? "s" : ""} lista${planillasCerradas !== 1 ? "s" : ""} para iniciar un recorrido`
                                : "Cierre las planillas para poder iniciar un recorrido"}
                        </p>
                    </div>
                    {canManage && (
                        <button
                            onClick={handleCreateClick}
                            disabled={planillasCerradas === 0}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                            <Route className="w-4 h-4" />
                            Iniciar Recorrido
                        </button>
                    )}
                </div>
            )}

            {/* Info de planillas abiertas */}
            {planillasAbiertas > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                        <strong>{planillasAbiertas}</strong> planilla{planillasAbiertas !== 1 ? "s" : ""} en estado{" "}
                        <strong>Generada</strong> sin cerrar. Solo las planillas <strong>Cerradas</strong> se incluyen en el recorrido.
                    </span>
                </div>
            )}

            {/* Modal Advertencia Planillas Abiertas */}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Planillas sin cerrar</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Existen <strong>{planillasAbiertas}</strong> planilla{planillasAbiertas !== 1 ? "s" : ""} en estado{" "}
                                    <strong>Generada</strong> que no se incluirán en el recorrido.
                                    Solo se incluirán las <strong>{planillasCerradas}</strong> planilla{planillasCerradas !== 1 ? "s" : ""} cerrada{planillasCerradas !== 1 ? "s" : ""}.
                                    ¿Desea continuar de todas formas?
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowWarning(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmWarning} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl">
                                Continuar con cerradas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Recorrido */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">
                                {recorridoActivo ? "Agregar Planillas al Recorrido" : "Iniciar Nuevo Recorrido"}
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                                </div>
                            )}
                            {!recorridoActivo && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Recorrido</label>
                                    <div className="flex gap-2">
                                        {["AM", "PM", "EXCEPCIONAL"].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTipo(t)}
                                                className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                                                    tipo === t
                                                        ? "bg-orange-500 text-white border-orange-500"
                                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas <span className="text-gray-400 text-xs">(opcional)</span></label>
                                <textarea
                                    value={notas}
                                    onChange={e => setNotas(e.target.value)}
                                    rows={2}
                                    placeholder="Observaciones del recorrido..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                                Se incluirán <strong>{planillasCerradas}</strong> planilla{planillasCerradas !== 1 ? "s" : ""} cerrada{planillasCerradas !== 1 ? "s" : ""} en el recorrido.
                                Se notificará por correo a los responsables de cada agencia cuando el servicio de correo esté configurado.
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
                                    Cancelar
                                </button>
                                <button onClick={handleCreate} disabled={isPending} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                                    {isPending ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> : <Route className="w-4 h-4" />}
                                    {recorridoActivo ? "Agregar al Recorrido" : "Iniciar Recorrido"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
