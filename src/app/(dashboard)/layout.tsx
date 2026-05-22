import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LayoutWrapper from "@/components/layout/LayoutWrapper";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) redirect("/login");

    return (
        <LayoutWrapper session={session}>
            {children}
        </LayoutWrapper>
    );
}
