import { prisma } from "@/lib/prisma"
import { Building } from "lucide-react"
import SedesClient from "./SedesClient"

export default async function SedesPage() {
    const sedes = await prisma.sede.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { agencias: true } } },
    })

    const data = sedes.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address ?? "",
        agenciasCount: s._count.agencias,
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Building className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sedes</h1>
                    <p className="text-sm text-gray-500">Administre las sedes físicas de la institución</p>
                </div>
            </div>
            <SedesClient sedes={data} />
        </div>
    )
}
