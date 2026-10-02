import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { MapPin } from "lucide-react"
import CiudadesClient from "./CiudadesClient"

export default async function CiudadesPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const ciudades = await prisma.ciudad.findMany({
        orderBy: [{ departamento: "asc" }, { nombre: "asc" }]
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <MapPin className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ciudades</h1>
                    <p className="text-sm text-gray-500">Gestione el catálogo de ciudades de origen y destino</p>
                </div>
            </div>
            <CiudadesClient ciudades={ciudades} />
        </div>
    )
}
