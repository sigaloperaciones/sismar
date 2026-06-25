"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ClipboardList, PackageCheck, Clock, ChevronRight, FileText, Lock, CheckCircle2, Inbox, Send } from "lucide-react"
import GenerateButton from "./GenerateButton"
import PlanillaStatusButton from "./PlanillaStatusButton"

interface PlanillasClientProps {
    agenciesWithPendingEntrante: any[]
    pendingSalienteCount: number
    recentPlanillasEntrante: any[]
    recentPlanillasSaliente: any[]
}

export default function PlanillasClient({
    agenciesWithPendingEntrante,
    pendingSalienteCount,
    recentPlanillasEntrante,
    recentPlanillasSaliente
}: PlanillasClientProps) {
    const [activeTab, setActiveTab] = useState<"ENTRANTE" | "SALIENTE">("ENTRANTE")

    const recentPlanillas = activeTab === "ENTRANTE" ? recentPlanillasEntrante : recentPlanillasSaliente

    const totalPending = activeTab === "ENTRANTE"
        ? agenciesWithPendingEntrante.reduce((sum, a) => sum + a.correspondenciaRecibida.length, 0)
        : pendingSalienteCount

    const countByEstado = {
        GENERADA: recentPlanillas.filter(p => p.estado === "GENERADA").length,
        CERRADA: recentPlanillas.filter(p => p.estado === "CERRADA").length,
        PROCESADA: recentPlanillas.filter(p => p.estado === "PROCESADA").length,
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shadow-sm">
                        <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planillas de Entrega</h1>
                        <p className="text-sm text-gray-500">Genere y gestione las planillas por tipo y agencia</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab("ENTRANTE")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "ENTRANTE"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        <Inbox className="w-4 h-4" />
                        Entrantes
                    </button>
                    <button
                        onClick={() => setActiveTab("SALIENTE")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "SALIENTE"
                                ? "bg-white text-emerald-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        <Send className="w-4 h-4" />
                        Salientes
                    </button>
                </div>
            </div>

            {totalPending > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm font-semibold flex items-center justify-between">
                    <span>
                        Hay <span className="font-bold text-amber-900">{totalPending}</span> documento{totalPending !== 1 ? "s" : ""} sin asignar en la pestaña actual.
                    </span>
                </div>
            )}

            {/* Stats de estados */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Generadas</p>
                        <p className="text-xl font-bold text-amber-600">{countByEstado.GENERADA}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Lock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Cerradas</p>
                        <p className="text-xl font-bold text-blue-600">{countByEstado.CERRADA}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-green-100 shadow-sm px-4 py-3 flex items-center gap-3 opacity-80">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Procesadas</p>
                        <p className="text-xl font-bold text-green-600">{countByEstado.PROCESADA}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generar nueva planilla */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-violet-500" />
                        <h2 className="font-semibold text-gray-800">Asignar a Planilla</h2>
                    </div>

                    {activeTab === "ENTRANTE" ? (
                        /* ENTRANTE: agrupado por agencia */
                        agenciesWithPendingEntrante.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <ClipboardList className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">Sin pendientes</p>
                                <p className="text-sm text-gray-400 mt-1">No hay correspondencia entrante por asignar</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {agenciesWithPendingEntrante.map(agencia => {
                                    const count = agencia.correspondenciaRecibida.length
                                    return (
                                        <div key={agencia.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-violet-200 transition-colors">
                                            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                                                <span className="text-lg font-bold text-violet-600">
                                                    {agencia.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800 truncate">{agencia.name}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    <span className="font-semibold text-amber-600">{count}</span>{" "}
                                                    documento{count !== 1 ? "s" : ""} pendiente{count !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <GenerateButton agenciaId={agencia.id} tipo="ENTRANTE" />
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    ) : (
                        /* SALIENTE: sin agrupar por agencia, un solo botón */
                        pendingSalienteCount === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <ClipboardList className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 font-medium">Sin pendientes</p>
                                <p className="text-sm text-gray-400 mt-1">No hay correspondencia saliente por asignar</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-emerald-200 transition-colors">
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                                    <Send className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-800">Correspondencia Saliente</p>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        <span className="font-semibold text-amber-600">{pendingSalienteCount}</span>{" "}
                                        documento{pendingSalienteCount !== 1 ? "s" : ""} pendiente{pendingSalienteCount !== 1 ? "s" : ""}
                                    </p>
                                </div>
                                <GenerateButton tipo="SALIENTE" />
                            </div>
                        )
                    )}
                </div>

                {/* Historial */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <h2 className="font-semibold text-gray-800">Planillas Recientes ({activeTab})</h2>
                    </div>

                    {recentPlanillas.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                            <p className="text-gray-400 text-sm">No hay planillas generadas aún</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                                {recentPlanillas.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                                        <Link href={`/planillas/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 text-sm truncate">
                                                    {p.agencia?.name || `Planilla #${p.id}`}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {format(p.fechaGeneracion, "dd/MM/yyyy HH:mm", { locale: es })}
                                                    {" · "}
                                                    <span>{p.correspondencias.length} item{p.correspondencias.length !== 1 ? "s" : ""}</span>
                                                </p>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                p.estado === "PROCESADA"
                                                    ? "bg-green-100 text-green-700"
                                                    : p.estado === "CERRADA"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-amber-100 text-amber-700"
                                            }`}>
                                                {p.estado === "PROCESADA" ? "Procesada" : p.estado === "CERRADA" ? "Cerrada" : "Generada"}
                                            </span>
                                            {/* Si es saliente, no se usa "PROCESADA" ni recorridos */}
                                            {!(activeTab === "SALIENTE" && p.estado === "CERRADA") && (
                                                <PlanillaStatusButton planillaId={p.id} estado={p.estado} tipo={p.tipo} />
                                            )}
                                            <Link href={`/planillas/${p.id}`}>
                                                <ChevronRight className="w-4 h-4 text-gray-300 hover:text-gray-500 transition-colors" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
