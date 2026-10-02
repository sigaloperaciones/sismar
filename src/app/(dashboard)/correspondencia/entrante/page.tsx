import { prisma } from "@/lib/prisma"
import EntranteClient from "./EntranteClient"
import { Inbox } from "lucide-react"
import AccessDenied from "@/components/AccessDenied"
import { can, requirePagePermission } from "@/lib/auth-guard"
import { PERMISOS } from "@/lib/permissions-catalog"
import { agenciaWhere, correspondenciaWhere } from "@/lib/tenancy"

export const revalidate = 0

export default async function CorrespondenciaEntrantePage() {
    // Guardian (req. cliente #2 + H-003 / C-007): ver el módulo exige el permiso de
    // lectura; registrar/completar exige el de creación (UI + re-verificación en la action).
    const auth = await requirePagePermission(PERMISOS.ENTRANTE_VER)
    if (!auth.ok) return <AccessDenied permiso={auth.permiso} />
    const ctx = auth.ctx
    const canCreate = await can(ctx, PERMISOS.ENTRANTE_CREAR)

    // H-003 / C-002 (A-01): catálogo de agencias y listado restringidos al alcance.
    const agencias = await prisma.agencia.findMany({ where: agenciaWhere(ctx), select: { id: true, name: true }, orderBy: { name: "asc" } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })
    const tiposAnexo = await prisma.tipoAnexo.findMany({ select: { id: true, name: true } })

    const entrantes = await prisma.correspondencia.findMany({
        where: {
            AND: [
                correspondenciaWhere(ctx),
                { planillaId: null, estado: "POR_ENTREGAR", tipo: "ENTRANTE" },
            ],
        },
        include: {
            agencia: true,
        },
        orderBy: {
            fechaRecepcion: "desc",
        },
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Inbox className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Correspondencia Entrante</h1>
                    <p className="text-sm text-gray-500">Gestione la correspondencia entrante y complete sus datos</p>
                </div>
            </div>

            <EntranteClient
                entrantes={entrantes}
                ciudades={ciudades}
                empresas={empresas}
                agencias={agencias}
                tiposAnexo={tiposAnexo}
                canCreate={canCreate}
            />
        </div>
    )
}
