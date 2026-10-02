import Link from "next/link"
import { ShieldOff } from "lucide-react"

/**
 * Denegación explícita para páginas (H-003 / C-007 — hallazgo M-01).
 * Reemplaza la redirección silenciosa a "/" cuando el usuario carece del permiso
 * del módulo. El intento ya quedó registrado en AuditLog por el guard.
 */
export default function AccessDenied({ permiso }: { permiso?: string }) {
    return (
        <div className="max-w-xl mx-auto mt-16 bg-white rounded-2xl border border-red-100 shadow-sm p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <ShieldOff className="w-7 h-7 text-red-500" />
            </div>
            <div>
                <p className="text-xs font-semibold tracking-widest text-red-500 uppercase">Error 403</p>
                <h1 className="text-2xl font-bold text-gray-900 mt-1">Acceso denegado</h1>
                <p className="text-sm text-gray-500 mt-2">
                    Su cuenta no tiene el permiso necesario para acceder a este módulo.
                    {permiso && (
                        <>
                            {" "}Permiso requerido: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{permiso}</code>.
                        </>
                    )}
                </p>
                <p className="text-xs text-gray-400 mt-2">Si cree que se trata de un error, contacte al administrador.</p>
            </div>
            <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
                Volver al inicio
            </Link>
        </div>
    )
}
