"use client"

import { useState, useTransition } from "react"
import { closePlanillaAction, reopenPlanillaAction } from "@/app/actions/planillas"
import { Lock, Unlock, CheckCircle2 } from "lucide-react"

interface PlanillaDetailStatusButtonProps {
    planillaId: number
    estado: string
    recorridoActivo: boolean
}

export default function PlanillaDetailStatusButton({ planillaId, estado, recorridoActivo }: PlanillaDetailStatusButtonProps) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")

    if (estado === "PROCESADA") {
        return (
            <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-sm font-semibold rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                Procesada
            </span>
        )
    }

    function handleToggle() {
        setError("")
        startTransition(async () => {
            const result = estado === "GENERADA"
                ? await closePlanillaAction(planillaId)
                : await reopenPlanillaAction(planillaId)
            if (result.error) setError(result.error)
        })
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleToggle}
                disabled={isPending || (estado === "CERRADA" && recorridoActivo)}
                title={estado === "CERRADA" && recorridoActivo ? "No se puede reabrir: está en un recorrido activo" : ""}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    estado === "GENERADA"
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-amber-100 hover:bg-amber-200 text-amber-800"
                }`}
            >
                {isPending ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                ) : estado === "GENERADA" ? (
                    <><Lock className="w-4 h-4" /> Cerrar Planilla</>
                ) : (
                    <><Unlock className="w-4 h-4" /> Reabrir Planilla</>
                )}
            </button>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            {estado === "CERRADA" && recorridoActivo && (
                <p className="text-xs text-amber-600">⚠ Está en un recorrido activo</p>
            )}
        </div>
    )
}
