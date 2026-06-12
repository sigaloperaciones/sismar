"use client"

import { useState, useTransition } from "react"
import {
    createAgenciaAction,
    updateAgenciaAction,
    deleteAgenciaAction
} from "@/app/actions/catalogos"
import { Building2, Plus, Pencil, Trash2, X, Check, AlertTriangle, Mail } from "lucide-react"

interface Sede {
    id: number
    name: string
}

interface CentroCosto {
    id: number
    code: string
    name: string
}

interface Agencia {
    id: number
    name: string
    email: string | null
    sedeId: number
    centroCostoId: number
    sede: Sede
    centroCosto: CentroCosto
}

export default function AgenciasClient({
    agencias,
    sedes,
    centrosCosto
}: {
    agencias: Agencia[]
    sedes: Sede[]
    centrosCosto: CentroCosto[]
}) {
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState<Agencia | null>(null)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [error, setError] = useState("")
    const [isPending, startTransition] = useTransition()

    function openCreate() {
        setEditItem(null)
        setError("")
        setShowModal(true)
    }

    function openEdit(agencia: Agencia) {
        setEditItem(agencia)
        setError("")
        setShowModal(true)
    }

    function handleSubmit(formData: FormData) {
        setError("")
        startTransition(async () => {
            let result
            if (editItem) {
                result = await updateAgenciaAction(editItem.id, null, formData)
            } else {
                result = await createAgenciaAction(null, formData)
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
            const result = await deleteAgenciaAction(id)
            if (result.error) {
                setError(result.error)
            } else {
                setDeleteId(null)
                window.location.reload()
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Agencia
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-gray-700">{agencias.length} agencia{agencias.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Agencia</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Sede</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Centro de Costo</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Email</th>
                                <th className="py-3 px-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {agencias.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p>No hay agencias registradas</p>
                                    </td>
                                </tr>
                            )}
                            {agencias.map(agencia => (
                                <tr key={agencia.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                                                <span className="text-sm font-bold text-green-600">{agencia.name.charAt(0)}</span>
                                            </div>
                                            <span className="font-medium text-gray-800">{agencia.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-gray-600">{agencia.sede.name}</td>
                                    <td className="py-3 px-4">
                                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                                            {agencia.centroCosto.code}
                                        </span>
                                        <span className="text-gray-500 ml-2 text-xs">{agencia.centroCosto.name}</span>
                                    </td>
                                    <td className="py-3 px-4 text-gray-500 text-xs">
                                        {agencia.email ? (
                                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agencia.email}</span>
                                        ) : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => openEdit(agencia)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Editar">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => { setDeleteId(agencia.id); setError("") }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">{editItem ? "Editar Agencia" : "Nueva Agencia"}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form action={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la Agencia</label>
                                <input name="name" defaultValue={editItem?.name} placeholder="Ej: Gerencia General" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sede</label>
                                <select name="sedeId" defaultValue={editItem?.sedeId} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" required>
                                    <option value="">Seleccione una sede...</option>
                                    {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Centro de Costo</label>
                                <select name="centroCostoId" defaultValue={editItem?.centroCostoId} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" required>
                                    <option value="">Seleccione un centro de costo...</option>
                                    {centrosCosto.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email de Notificación <span className="text-gray-400 text-xs">(opcional)</span></label>
                                <input name="email" type="email" defaultValue={editItem?.email || ""} placeholder="agencia@empresa.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
                                <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                                    {isPending ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> : <Check className="w-4 h-4" />}
                                    {editItem ? "Guardar Cambios" : "Crear Agencia"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">¿Eliminar agencia?</h3>
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
