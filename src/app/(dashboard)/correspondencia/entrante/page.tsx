import { prisma } from "@/lib/prisma"
import EntranteClient from "./EntranteClient"
import { Inbox } from "lucide-react"

export const revalidate = 0

export default async function CorrespondenciaEntrantePage() {
    const agencias = await prisma.agencia.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })
    const tiposAnexo = await prisma.tipoAnexo.findMany({ select: { id: true, name: true } })

    const entrantes = await prisma.correspondencia.findMany({
        where: {
            planillaId: null,
            estado: "POR_ENTREGAR",
            tipo: "ENTRANTE",
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
            />
        </div>
    )
}
