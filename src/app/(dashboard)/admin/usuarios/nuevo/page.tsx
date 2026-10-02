import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import UserForm from "../UserForm"
import { createUserAction } from "@/app/actions/admin"

export default async function NuevoUsuarioPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const agencias = await prisma.agencia.findMany({ orderBy: { name: "asc" } })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nuevo Usuario</h1>
                <p className="text-muted-foreground mt-1">Cree una nueva cuenta de acceso al sistema.</p>
            </div>
            <UserForm
                agencias={agencias}
                mode="create"
                onSubmit={createUserAction}
            />
        </div>
    )
}
