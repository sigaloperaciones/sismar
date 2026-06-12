import { prisma } from "@/lib/prisma"
import PendientesClient from "./PendientesClient"
import { ClipboardCheck } from "lucide-react"

export const revalidate = 0 // Desactivar cache para que los datos estén siempre frescos

export default async function PendientesPage() {
    const agencias = await prisma.agencia.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    const ciudades = await prisma.ciudad.findMany({ select: { nombre: true, departamento: true }, orderBy: { nombre: "asc" } })
    const empresas = await prisma.empresaMensajeria.findMany({ where: { activo: true }, select: { nombre: true }, orderBy: { nombre: "asc" } })

    // Obtener correspondencias pendientes (no asignadas a planilla)
    const correspondencias = await prisma.correspondencia.findMany({
        where: {
            planillaId: null,
            estado: "POR_ENTREGAR",
        },
        include: {
            agencia: true,
        },
        orderBy: {
            fechaRecepcion: "desc",
        },
    })

    const entrantes = correspondencias.filter(c => c.tipo === "ENTRANTE")
    const salientes = correspondencias.filter(c => c.tipo === "SALIENTE")

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Completar Pendientes</h1>
                    <p className="text-sm text-gray-500">Gestione la correspondencia entrante y saliente que aún no ha sido asociada a una planilla</p>
                </div>
            </div>

            <PendientesClient 
                entrantes={entrantes} 
                salientes={salientes} 
                ciudades={ciudades} 
                empresas={empresas}
                agencias={agencias}
            />
        </div>
    )
}
