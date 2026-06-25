"use client"

import { useState, useTransition } from "react"
import {
    createEmpresaMensajeriaAction,
    updateEmpresaMensajeriaAction,
    deleteEmpresaMensajeriaAction
} from "@/app/actions/catalogos"
import { Truck, Plus, Pencil, Trash2, X, Check, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

interface Empresa {
    id: number
    nombre: string
    activo: boolean
    nombreMensajero?: string | null
    rutasPersonalizadas?: boolean
}

export default function EmpresasClient({ empresas }: { empresas: Empresa[] }) {
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState<Empresa | null>(null)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [error, setError] = useState("")
    const [isPending, startTransition] = useTransition()
    const [localEmpresas, setLocalEmpresas] = useState(empresas)
    const [activoEdit, setActivoEdit] = useState(true)

    const [rutasEdit, setRutasEdit] = useState(false)

    function openCreate() {
        setEditItem(null)
        setActivoEdit(true)
        setRutasEdit(false)
        setError("")
        setShowModal(true)
    }

    function openEdit(empresa: Empresa) {
        setEditItem(empresa)
        setActivoEdit(empresa.activo)
        setRutasEdit(empresa.rutasPersonalizadas ?? false)
        setError("")
        setShowModal(true)
    }

    function handleSubmit(formData: FormData) {
        formData.set("activo", String(activoEdit))
        formData.set("rutasPersonalizadas", String(rutasEdit))
        setError("")
        startTransition(async () => {
            let result
            if (editItem) {
                result = await updateEmpresaMensajeriaAction(editItem.id, null, formData)
            } else {
                result = await createEmpresaMensajeriaAction(null, formData)
            }
            if (result.error) {
                setError(result.error)
            } else {
                setShowModal(false)
                window.location.reload()
            }
        })
    }

    function handleDelete(id: number) {
        startTransition(async () => {
            const result = await deleteEmpresaMensajeriaAction(id)
            if (result.error) {
                setError(result.error)
            } else {
                setDeleteId(null)
                setLocalEmpresas(prev => prev.filter(e => e.id !== id))
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Empresa
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center">
                    <div className="flex items-center gap-2 flex-1">
                        <Truck className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-gray-700">{localEmpresas.length} empresa{localEmpresas.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="w-48 hidden md:block text-xs font-semibold text-gray-500 uppercase">Mensajero</div>
                    <div className="w-40 hidden md:block text-xs font-semibold text-gray-500 uppercase">Rutas Person.</div>
                    <div className="w-24 hidden md:block text-xs font-semibold text-gray-500 uppercase text-center">Estado</div>
                    <div className="w-16"></div>
                </div>
                <div className="divide-y divide-gray-50">
                    {localEmpresas.length === 0 && (
                        <div className="py-12 text-center text-gray-400">
                            <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>No hay empresas de mensajería registradas</p>
                        </div>
                    )}
                    {localEmpresas.map(empresa => (
                        <div key={empresa.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                <Truck className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800">{empresa.nombre}</p>
                            </div>
                            <div className="w-48 hidden md:block text-sm text-gray-600 truncate" title={empresa.nombreMensajero || ""}>
                                {empresa.nombreMensajero || "—"}
                            </div>
                            <div className="w-40 hidden md:flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={empresa.rutasPersonalizadas ?? false}
                                    readOnly
                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 opacity-80 cursor-default"
                                />
                                <span className="text-xs text-gray-500">Aplica</span>
                            </div>
                            <div className="w-24 text-center">
                                {empresa.activo ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                        <CheckCircle className="w-3 h-3" /> Activa
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        <XCircle className="w-3 h-3" /> Inactiva
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-end w-16 gap-1">
                                <button
                                    onClick={() => openEdit(empresa)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setDeleteId(empresa.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Crear/Editar */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">{editItem ? "Editar Empresa" : "Nueva Empresa de Mensajería"}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form action={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la Empresa</label>
                                <input
                                    name="nombre"
                                    defaultValue={editItem?.nombre}
                                    placeholder="Ej: Servientrega, TCC, Deprisa..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del Mensajero</label>
                                <input
                                    name="nombreMensajero"
                                    defaultValue={editItem?.nombreMensajero || ""}
                                    placeholder="Ej: Juan Perez"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="rutasPersonalizadas"
                                    checked={rutasEdit}
                                    onChange={(e) => setRutasEdit(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="rutasPersonalizadas" className="text-sm font-medium text-gray-700">
                                    ¿Hace rutas personalizadas?
                                </label>
                            </div>
                            {editItem && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setActivoEdit(true)}
                                            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${activoEdit ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                        >
                                            Activa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActivoEdit(false)}
                                            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${!activoEdit ? "bg-gray-500 text-white border-gray-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                        >
                                            Inactiva
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {isPending ? (
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                    ) : <Check className="w-4 h-4" />}
                                    {editItem ? "Guardar Cambios" : "Crear Empresa"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Delete */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">¿Eliminar empresa?</h3>
                            <p className="text-sm text-gray-500 mt-1">Esta acción no se puede deshacer.</p>
                            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setDeleteId(null); setError("") }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
                            <button onClick={() => handleDelete(deleteId)} disabled={isPending} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl">
                                {isPending ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
