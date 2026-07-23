import { prisma } from "@/lib/prisma"
import SalienteClient from "./SalienteClient"
import { Send } from "lucide-react"
import { requirePermission } from "@/lib/auth-guard"
import { hasPermission } from "@/lib/permissions"

export const revalidate = 0

export default async function CorrespondenciaSalientePage() {
    // Guardian (req. cliente #2): ver exige el permiso de lectura; registrar/completar
    // exige el permiso de creación (se refleja en la UI y se re-verifica en la action).
    const session = await requirePermission("correspondencia.saliente.ver")
    const canCreate = await hasPermission(
        session.userId as number,
        session.role as string,
        "correspondencia.saliente.crear"
    )

    const agencias = await prisma.agencia.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true, nombreMensajero: true }, orderBy: { nombre: "asc" } })
    const tiposAnexo = await prisma.tipoAnexo.findMany({ select: { id: true, name: true } })

    const salientes = await prisma.correspondencia.findMany({
        where: {
            planillaId: null,
            estado: "POR_ENTREGAR",
            tipo: "SALIENTE",
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
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                    <Send className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Correspondencia Saliente</h1>
                    <p className="text-sm text-gray-500">Gestione la correspondencia saliente y complete sus datos</p>
                </div>
            </div>

            <SalienteClient
                salientes={salientes}
                ciudades={ciudades}
                empresas={empresas}
                agencias={agencias}
                tiposAnexo={tiposAnexo}
                canCreate={canCreate}
            />
        </div>
    )
}
