"use client"

import { useState, useTransition, useRef } from "react"
import {
    createCentroCostoAction,
    updateCentroCostoAction,
    deleteCentroCostoAction,
} from "@/app/actions/catalogos"
import { Search, Plus, Pencil, Trash2, Wallet, X, Check, AlertTriangle } from "lucide-react"

interface CentroCosto {
    id: number
    code: string
    name: string
    agenciasCount: number
}

export default function CentrosCostoClient({ centros }: { centros: CentroCosto[] }) {
    const [search, setSearch] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState<CentroCosto | null>(null)
    const [deleteItem, setDeleteItem] = useState<CentroCosto | null>(null)
    const [error, setError] = useState("")
    const [isPending, startTransition] = useTransition()
    const formRef = useRef<HTMLFormElement>(null)

    const filtered = centros.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    function openCreate() {
        setEditItem(null)
        setError("")
        setShowModal(true)
    }

    function openEdit(item: CentroCosto) {
        setEditItem(item)
        setError("")
        setShowModal(true)
    }

    function handleSubmit(formData: FormData) {
        setError("")
        startTransition(async () => {
            const result = editItem
                ? await updateCentroCostoAction(editItem.id, null, formData)
                : await createCentroCostoAction(null, formData)
            if (result.error) {
                setError(result.error)
            } else {
                setShowModal(false)
                window.location.reload()
            }
        })
    }

    function handleDelete(item: CentroCosto) {
        setError("")
        startTransition(async () => {
            const result = await deleteCentroCostoAction(item.id)
            if (result.error) {
                setError(result.error)
            } else {
                setDeleteItem(null)
                window.location.reload()
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código o nombre..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Centro de Costo
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-gray-700">
                        {filtered.length} centro{filtered.length !== 1 ? "s" : ""} de costo
                        {search && ` (filtrado de ${centros.length})`}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Código</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nombre</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Agencias</th>
                                <th className="py-3 px-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">
                                        <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p>{search ? "Sin resultados para la búsqueda" : "No hay centros de costo registrados"}</p>
                                    </td>
                                </tr>
                            )}
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-semibold">
                                            {item.code}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-medium text-gray-800">{item.name}</td>
                                    <td className="py-3 px-4 text-gray-500">{item.agenciasCount}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => { setDeleteItem(item); setError("") }}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">
                                {editItem ? "Editar Centro de Costo" : "Nuevo Centro de Costo"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form action={handleSubmit} ref={formRef} className="p-6 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            {editItem ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Código</label>
                                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-600">
                                        {editItem.code}
                                        <span className="text-gray-400 ml-2 text-xs">(asignado automáticamente)</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700">
                                    El código se asignará automáticamente de forma correlativa (001, 002, 003…).
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del Centro de Costo</label>
                                <input
                                    name="name"
                                    defaultValue={editItem?.name}
                                    placeholder="Ej: Financiera"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                    required
                                    autoFocus
                                />
                            </div>
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
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {isPending ? (
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                    ) : <Check className="w-4 h-4" />}
                                    {editItem ? "Guardar Cambios" : "Crear"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteItem !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">¿Eliminar centro de costo?</h3>
                            <p className="text-sm text-gray-500 mt-1">{deleteItem.code} — {deleteItem.name}. Esta acción no se puede deshacer.</p>
                            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setDeleteItem(null); setError("") }}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteItem)}
                                disabled={isPending}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                {isPending ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
