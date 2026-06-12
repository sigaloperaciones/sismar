"use client"

import { Button } from "@/components/ui/button"
import { deleteUserAction } from "@/app/actions/admin"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { useState } from "react"

export default function DeleteUserButton({ id, username }: { id: number; username: string }) {
    const { toast } = useToast()
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleDelete() {
        if (!confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return
        setLoading(true)
        const res = await deleteUserAction(id)
        if (res?.error) {
            toast({ title: "Error", description: res.error, variant: "destructive" })
        } else {
            toast({ title: "Usuario eliminado" })
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={handleDelete} disabled={loading}>
            <Trash2 className="w-4 h-4 mr-1" />
            Eliminar
        </Button>
    )
}
