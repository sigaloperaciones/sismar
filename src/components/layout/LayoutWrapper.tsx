import { Sidebar } from "./Sidebar";
import type { SessionPayload } from "@/lib/auth";

export default function LayoutWrapper({
    children,
    session,
}: {
    children: React.ReactNode;
    session: SessionPayload;
}) {
    return (
        <div className="flex min-h-screen print:block print:min-h-0 print:w-full">
            <Sidebar role={session.role} username={session.username} />
            <main className="flex-1 md:ml-0 transition-all duration-200 ease-in-out w-full print:m-0 print:p-0 print:w-full print:block">
                <div className="container mx-auto p-4 md:p-8 pt-20 md:pt-8 min-h-screen print:p-0 print:pt-0 print:m-0 print:max-w-none print:min-h-0 print:w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
