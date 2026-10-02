import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Building2 } from "lucide-react"
import AgenciasClient from "./AgenciasClient"

export default async function AgenciasPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const [agencias, sedes, centrosCosto] = await Promise.all([
        prisma.agencia.findMany({
            include: { sede: true, centroCosto: true },
            orderBy: { name: "asc" }
        }),
        prisma.sede.findMany({ orderBy: { name: "asc" } }),
        prisma.centroCosto.findMany({ orderBy: { code: "asc" } })
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                    <Building2 className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agencias</h1>
                    <p className="text-sm text-gray-500">Gestione las agencias y sus asignaciones de sede y centro de costo</p>
                </div>
            </div>
            <AgenciasClient agencias={agencias} sedes={sedes} centrosCosto={centrosCosto} />
        </div>
    )
}
