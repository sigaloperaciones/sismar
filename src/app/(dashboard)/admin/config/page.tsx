import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import ConfigForm from "./ConfigForm"

export default async function ConfigPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const config = await prisma.empresaConfig.findFirst()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración de Empresa</h1>
                <p className="text-muted-foreground mt-1">
                    Personalice los datos y el aspecto visual del sistema para su empresa.
                </p>
            </div>
            <ConfigForm config={config} />
        </div>
    )
}
