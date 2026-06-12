import { prisma } from "@/lib/prisma"
import OutgoingMailForm from "@/components/forms/OutgoingMailForm"
import { ArrowUpRight } from "lucide-react"

export default async function OutgoingMailPage() {
    const agencias = await prisma.agencia.findMany({ select: { id: true, name: true } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Correspondencia Saliente</h1>
                    <p className="text-sm text-gray-500">Registre la correspondencia que sale hacia el exterior</p>
                </div>
            </div>

            <div className="max-w-3xl">
                <OutgoingMailForm agencias={agencias} ciudades={ciudades} empresas={empresas} />
            </div>
        </div>
    )
}
