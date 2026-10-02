import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import PermissionMatrix from "./PermissionMatrix"

export default async function PermisosPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    const [permisos, rolPermisos, usuarios, usuarioPermisos] = await Promise.all([
        prisma.permiso.findMany({ orderBy: [{ modulo: "asc" }, { codigo: "asc" }] }),
        prisma.rolPermiso.findMany(),
        prisma.usuario.findMany({
            select: { id: true, username: true, role: true },
            orderBy: { username: "asc" },
        }),
        prisma.usuarioPermiso.findMany(),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Matriz de Permisos</h1>
                <p className="text-muted-foreground mt-1">
                    Configure los permisos por rol y aplique sobreescrituras individuales por usuario.
                </p>
            </div>
            <PermissionMatrix
                permisos={permisos}
                rolPermisos={rolPermisos}
                usuarios={usuarios}
                usuarioPermisos={usuarioPermisos}
            />
        </div>
    )
}
