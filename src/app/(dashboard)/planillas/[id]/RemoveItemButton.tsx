"use client"

import { useState, useTransition } from "react"
import { removeCorrespondenciaFromPlanillaAction } from "@/app/actions/planillas"
import { Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function RemoveItemButton({ itemId }: { itemId: number }) {
    const [isPending, startTransition] = useTransition()
    const { toast } = useToast()

    function handleClick() {
        if (!confirm("¿Está seguro de que desea quitar esta correspondencia de la planilla? Volverá a estar pendiente.")) {
            return
        }

        startTransition(async () => {
            const result = await removeCorrespondenciaFromPlanillaAction(itemId)
            if (result.error) {
                toast({
                    title: "Error al quitar",
                    description: result.error,
                    variant: "destructive"
                })
            } else if (result.success) {
                toast({
                    title: "Correspondencia removida",
                    description: "El documento ha vuelto a estar en estado pendiente."
                })
            }
        })
    }

    return (
        <button
            onClick={handleClick}
            disabled={isPending}
            className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors print:hidden"
            title="Quitar de la planilla"
        >
            {isPending ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            ) : (
                <Trash2 className="w-4 h-4" />
            )}
        </button>
    )
}
