import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import UserForm from "../UserForm"
import { updateUserAction } from "@/app/actions/admin"

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userId = parseInt(id)

    const [usuario, agencias] = await Promise.all([
        prisma.usuario.findUnique({ where: { id: userId } }),
        prisma.agencia.findMany({ orderBy: { name: "asc" } }),
    ])

    if (!usuario) notFound()

    const onSubmitAction = updateUserAction.bind(null, userId)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Editar Usuario</h1>
                <p className="text-muted-foreground mt-1">Modifique los datos de <strong>{usuario.username}</strong>.</p>
            </div>
            <UserForm
                agencias={agencias}
                mode="edit"
                defaultValues={{
                    id: usuario.id,
                    username: usuario.username,
                    role: usuario.role as "ADMIN" | "MENSAJERO" | "AGENCIA",
                    agenciaId: usuario.agenciaId ? String(usuario.agenciaId) : "",
                }}
                onSubmit={onSubmitAction}
            />
        </div>
    )
}
