"use client"

import { useState, useTransition } from "react"
import { closePlanillaAction, reopenPlanillaAction } from "@/app/actions/panillas"
import { Lock, Unlock } from "lucide-react"

export default function PlanillaStatusButton({ planillaId, estado, tipo }: { planillaId: number; estado: string; tipo?: string }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")

    if (estado === "PROCESADA") return null

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
        <div className="relative">
            <button
                onClick={handleToggle}
                disabled={isPending}
                title={estado === "GENERADA" ? "Cerrar planilla" : "Reabrir planilla"}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                    estado === "GENERADA"
                        ? "text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                        : "text-amber-400 hover:text-amber-600 hover:bg-amber-50"
                }`}
            >
                {isPending ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                ) : estado === "GENERADA" ? (
                    <Lock className="w-3.5 h-3.5" />
                ) : (
                    <Unlock className="w-3.5 h-3.5" />
                )}
            </button>
            {error && (
                <div className="absolute right-0 top-8 z-10 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 w-52 shadow-lg">
                    {error}
                </div>
            )}
        </div>
    )
}
