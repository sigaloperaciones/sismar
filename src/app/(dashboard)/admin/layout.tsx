import AccessDenied from "@/components/AccessDenied"
import { requireAdminPage } from "@/lib/auth-guard"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // H-003 / C-005: rol leído de BD en cada petición; denegación explícita
    // (no redirección silenciosa). Las server actions de administración
    // repiten la verificación con requireAdmin().
    const auth = await requireAdminPage()
    if (!auth.ok) return <AccessDenied permiso="rol ADMIN" />
    return <>{children}</>
}
