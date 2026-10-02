import { requireSession } from "@/lib/auth-guard";
import { getUserPermissions } from "@/lib/permissions";
import LayoutWrapper from "@/components/layout/LayoutWrapper";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // H-003 / C-001: sesión VIVA en BD y rol/agencia frescos (no el JWT).
    // Si la sesión fue revocada o el usuario ya no existe → /login.
    const ctx = await requireSession();

    // Guardian (req. cliente #2): el menú se construye con los permisos EFECTIVOS
    // del usuario (rol + overrides). Las páginas y acciones re-verifican en servidor.
    const permisos = await getUserPermissions(ctx.userId, ctx.role);

    return (
        <LayoutWrapper session={{ username: ctx.username, role: ctx.role }} permissions={Array.from(permisos)}>
            {children}
        </LayoutWrapper>
    );
}
