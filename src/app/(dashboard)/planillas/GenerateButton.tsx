"use client"

import { useState, useTransition } from "react"
import { generatePlanillaAction } from "@/app/actions/panillas"
import { ClipboardPlus, Plus } from "lucide-react"

export default function GenerateButton({ agenciaId }: { agenciaId: number }) {
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    function handleClick() {
        setMessage(null)
        startTransition(async () => {
            const result = await generatePlanillaAction(agenciaId)
            if (result.error) {
                setMessage({ type: "error", text: result.error })
            } else if (result.success) {
                setMessage({
                    type: "success",
                    text: result.wasExisting
                        ? `Agregado a planilla #${result.planillaId} existente`
                        : `Planilla #${result.planillaId} creada`
                })
            }
        })
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleClick}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-xs font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
                {isPending ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                ) : (
                    <Plus className="w-3.5 h-3.5" />
                )}
                Asignar
            </button>
            {message && (
                <p className={`text-[10px] font-medium ${message.type === "error" ? "text-red-500" : "text-green-600"}`}>
                    {message.text}
                </p>
            )}
        </div>
    )
}
