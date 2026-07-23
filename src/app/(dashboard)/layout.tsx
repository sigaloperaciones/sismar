import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import LayoutWrapper from "@/components/layout/LayoutWrapper";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) redirect("/login");

    // Guardian (req. cliente #2): el menú se construye con los permisos EFECTIVOS
    // del usuario (rol + overrides), no solo con el rol. Así, denegar un permiso
    // oculta el módulo correspondiente sin tocar cada usuario individualmente.
    const permisos = await getUserPermissions(
        session.userId as number,
        session.role as string
    );

    return (
        <LayoutWrapper session={session} permissions={Array.from(permisos)}>
            {children}
        </LayoutWrapper>
    );
}
