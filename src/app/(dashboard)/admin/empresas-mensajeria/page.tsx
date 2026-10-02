import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Truck } from "lucide-react"
import EmpresasClient from "./EmpresasClient"

export default async function EmpresasMensajeriaPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const empresas = await prisma.empresaMensajeria.findMany({
        orderBy: { nombre: "asc" }
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Truck className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Empresas de Mensajería</h1>
                    <p className="text-sm text-gray-500">Gestione el catálogo de empresas mensajeras</p>
                </div>
            </div>
            <EmpresasClient empresas={empresas} />
        </div>
    )
}
