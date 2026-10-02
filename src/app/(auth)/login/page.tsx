"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { loginAction } from "@/app/actions/auth"

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    // H-003 / C-001: la sesión fue cerrada o revocada en el servidor.
    const expired = useSearchParams().get("expired") === "1"

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        const username = formData.get("username")
        const password = formData.get("password")

        if (!username || !password) {
            setError("Por favor ingrese usuario y contraseña")
            setLoading(false)
            return
        }

        try {
            const result = await loginAction(formData)
            if (result?.error) {
                setError(result.error)
            }
        } catch {
            setError("Ocurrió un error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Panel izquierdo — branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-blue-700 flex-col items-center justify-center p-12 text-white">
                <div className="max-w-md text-center space-y-6">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                            <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                            <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">SISMAR</h1>
                        <p className="text-blue-200 text-lg mt-2">Sistema de Gestión de Correspondencia</p>
                    </div>
                    <p className="text-blue-100 leading-relaxed">
                        Gestione la correspondencia interna y externa de su organización de forma eficiente y segura.
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                        {[
                            { label: "Entrante", icon: "↓" },
                            { label: "Saliente", icon: "↑" },
                            { label: "Reportes", icon: "≡" },
                        ].map((item) => (
                            <div key={item.label} className="bg-white/10 rounded-xl p-3 text-center">
                                <div className="text-2xl">{item.icon}</div>
                                <div className="text-xs text-blue-200 mt-1">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Panel derecho — formulario */}
            <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
                <div className="w-full max-w-md space-y-8">
                    {/* Logo móvil */}
                    <div className="lg:hidden text-center">
                        <div className="w-14 h-14 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                                <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                                <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-blue-700">SISMAR</h1>
                    </div>

                    {/* Encabezado */}
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Bienvenido</h2>
                        <p className="text-gray-500 mt-2">Ingrese sus credenciales para continuar</p>
                    </div>

                    {/* Formulario */}
                    <form action={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Usuario
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
                                placeholder="Ingrese su usuario"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
                                placeholder="Ingrese su contraseña"
                            />
                        </div>

                        {expired && !error && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                <span className="mt-0.5">ⓘ</span>
                                <span>Su sesión expiró o fue cerrada. Ingrese nuevamente.</span>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <span className="mt-0.5">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Ingresando...
                                </span>
                            ) : "Ingresar"}
                        </button>
                    </form>

                    {/* Branding AISerNet (obligatorio en toda app): NEBULA 10 pt */}
                    <p className="brand-credit text-center text-slate-400 pt-4">By AISerNet Company</p>
                </div>
            </div>
        </div>
    )
}
