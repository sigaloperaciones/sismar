"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Inbox,
    Send,
    FileText,
    Truck,
    BarChart3,
    Home,
    LogOut,
    Menu,
    Settings,
    Building2,
    Building,
    Wallet,
    MapPin,
    Inbox as InboxIcon,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { ModeToggle } from "../mode-toggle";
import { logoutAction } from "@/app/actions/auth";

const mainMenuItems = [
    { name: "Inicio", href: "/", icon: Home },
    { name: "Correspondencia Entrante", href: "/correspondencia/entrante", icon: InboxIcon },
    { name: "Correspondencia Saliente", href: "/correspondencia/saliente", icon: Send },
    { name: "Mis Planillas", href: "/mi-correspondencia", icon: ClipboardCheck },
    { name: "Planillas", href: "/planillas", icon: FileText },
    { name: "Recorridos", href: "/recorridos", icon: Truck },
    { name: "Reportes", href: "/reportes", icon: BarChart3 },
];


const adminMenuItems = [
    { name: "Configuración", href: "/admin/config", icon: Settings },
    { name: "Usuarios", href: "/admin/usuarios", icon: null },
    { name: "Permisos", href: "/admin/permisos", icon: null },
    { name: "Sedes", href: "/admin/sedes", icon: Building },
    { name: "Centros de Costo", href: "/admin/centros-costo", icon: Wallet },
    { name: "Agencias", href: "/admin/agencias", icon: Building2 },
    { name: "Empresas Mensajería", href: "/admin/empresas-mensajeria", icon: Truck },
    { name: "Ciudades", href: "/admin/ciudades", icon: MapPin },
];

interface SidebarProps {
    role: string;
    username: string;
}

export function Sidebar({ role, username }: SidebarProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [adminExpanded, setAdminExpanded] = useState(pathname.startsWith("/admin"));

    const isAdminActive = pathname.startsWith("/admin");

    return (
        <>
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:translate-x-0 md:relative print:hidden",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <img src="/logo-clinica-foscal.png" />
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                SISMAR
                            </h1>
                            <p className="text-xs text-slate-400 mt-1">{username}</p>
                        </div>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {mainMenuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.href);

                            // Ocultar "Mi Correspondencia" para no-AGENCIA y no-ADMIN
                            if (item.href === "/mi-correspondencia" && role !== "AGENCIA" && role !== "ADMIN") {
                                return null;
                            }

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                        isActive
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Icon className="w-5 h-5 mr-3" />
                                    {item.name}
                                </Link>
                            );
                        })}

                        {/* Sección Administración */}
                        {role === "ADMIN" && (
                            <div className="pt-2">
                                <button
                                    onClick={() => setAdminExpanded(!adminExpanded)}
                                    className={cn(
                                        "w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                        isAdminActive
                                            ? "bg-slate-700 text-white"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <Settings className="w-5 h-5 mr-3" />
                                    Administración
                                    <span className="ml-auto">
                                        {adminExpanded
                                            ? <ChevronDown className="w-4 h-4" />
                                            : <ChevronRight className="w-4 h-4" />
                                        }
                                    </span>
                                </button>

                                {adminExpanded && (
                                    <div className="ml-3 mt-1 space-y-1 border-l border-slate-700 pl-3">
                                        {adminMenuItems.map(item => {
                                            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        "flex items-center px-3 py-2 text-sm rounded-lg transition-colors",
                                                        isActive
                                                            ? "bg-blue-600 text-white"
                                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                    )}
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    {item.name}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <form action={logoutAction}>
                            <Button
                                variant="ghost"
                                type="submit"
                                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800"
                            >
                                <LogOut className="w-5 h-5 mr-3" />
                                Cerrar Sesión
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Mobile Toggle */}
            <div className="fixed top-0 left-0 z-40 p-4 md:hidden print:hidden">
                <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)} className="bg-white">
                    <Menu className="w-5 h-5" />
                </Button>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
