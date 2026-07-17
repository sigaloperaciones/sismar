import { prisma } from "@/lib/prisma"
import { Wallet } from "lucide-react"
import CentrosCostoClient from "./CentrosCostoClient"

export default async function CentrosCostoPage() {
    const centros = await prisma.centroCosto.findMany({
        orderBy: { code: "asc" },
        include: { _count: { select: { agencias: true } } },
    })

    const data = centros.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        agenciasCount: c._count.agencias,
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <Wallet className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Centros de Costo</h1>
                    <p className="text-sm text-gray-500">Administre los centros de costo / dependencias de la institución</p>
                </div>
            </div>
            <CentrosCostoClient centros={data} />
        </div>
    )
}
