import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, ShieldCheck, MapPin, Truck, Settings2 } from "lucide-react"

const sections = [
    {
        title: "Configuración de Empresa",
        description: "Nombre, NIT, logo y paleta de colores de la empresa.",
        href: "/admin/config",
        icon: Building2,
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
        title: "Gestión de Usuarios",
        description: "Crear, editar y eliminar usuarios del sistema.",
        href: "/admin/usuarios",
        icon: Users,
        color: "text-green-600",
        bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
        title: "Matriz de Permisos",
        description: "Configurar permisos por rol y por usuario individual.",
        href: "/admin/permisos",
        icon: ShieldCheck,
        color: "text-purple-600",
        bg: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
        title: "Agencias",
        description: "Crear y gestionar las agencias del sistema.",
        href: "/admin/agencias",
        icon: Settings2,
        color: "text-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
        title: "Empresas de Mensajería",
        description: "Catálogo de empresas mensajeras utilizadas.",
        href: "/admin/empresas-mensajeria",
        icon: Truck,
        color: "text-indigo-600",
        bg: "bg-indigo-50 dark:bg-indigo-950/30",
    },
    {
        title: "Ciudades",
        description: "Catálogo de ciudades de origen y destino.",
        href: "/admin/ciudades",
        icon: MapPin,
        color: "text-cyan-600",
        bg: "bg-cyan-50 dark:bg-cyan-950/30",
    },
]

export default async function AdminPage() {
    // H-003 / R-028 (AC-016): guard PROPIO. Los layouts de Next no son frontera de
    // seguridad (una petición RSC puede declararlos ya renderizados). El layout
    // /admin queda como defensa adicional.
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Administración</h1>
                <p className="text-muted-foreground mt-1">Configure el sistema a su medida.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => {
                    const Icon = section.icon
                    return (
                        <Link key={section.href} href={section.href}>
                            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/30">
                                <CardHeader>
                                    <div className={`w-12 h-12 rounded-full ${section.bg} flex items-center justify-center mb-2`}>
                                        <Icon className={`w-6 h-6 ${section.color}`} />
                                    </div>
                                    <CardTitle className="text-lg">{section.title}</CardTitle>
                                    <CardDescription>{section.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
