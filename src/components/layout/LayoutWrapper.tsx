import { Sidebar } from "./Sidebar";

interface SessionPayload {
    userId: number;
    username: string;
    role: string;
    agenciaId?: number;
}

export default function LayoutWrapper({
    children,
    session,
}: {
    children: React.ReactNode;
    session: SessionPayload;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar role={session.role} username={session.username} />
            <main className="flex-1 md:ml-0 transition-all duration-200 ease-in-out w-full">
                <div className="container mx-auto p-4 md:p-8 pt-20 md:pt-8 min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    );
}
