import { prisma } from "@/lib/prisma"
import UserForm from "../UserForm"
import { createUserAction } from "@/app/actions/admin"

export default async function NuevoUsuarioPage() {
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
                onSubmit={(formData) => createUserAction(null, formData)}
            />
        </div>
    )
}
