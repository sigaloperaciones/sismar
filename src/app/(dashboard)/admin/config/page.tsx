import { prisma } from "@/lib/prisma"
import ConfigForm from "./ConfigForm"

export default async function ConfigPage() {
    const config = await prisma.empresaConfig.findFirst()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración de Empresa</h1>
                <p className="text-muted-foreground mt-1">
                    Personalice los datos y el aspecto visual del sistema para su empresa.
                </p>
            </div>
            <ConfigForm config={config} />
        </div>
    )
}
