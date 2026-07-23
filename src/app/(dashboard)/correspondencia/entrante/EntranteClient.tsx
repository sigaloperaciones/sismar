"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { updateMailAction } from "@/app/actions/correspondencia"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
    Search, 
    Edit2, 
    Inbox, 
    Send, 
    X, 
    AlertCircle, 
    FileText, 
    ExternalLink, 
    Save, 
    User, 
    MapPin, 
    Building2,
    Calendar,
    Truck,
    HelpCircle,
    Plus
} from "lucide-react"
import IncomingMailForm from "@/components/forms/IncomingMailForm"
import OutgoingMailForm from "@/components/forms/OutgoingMailForm"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Mail {
    id: number
    consecutive: string | null
    tipo: string
    fechaRecepcion: Date
    empresaMensajeria: string | null
    remitenteNombre: string | null
    remitenteCiudad: string | null
    asunto: string
    importancia: string
    necesitaRespuesta: boolean
    estado: string
    agenciaId: number
    agencia: {
        id: number
        name: string
    }
    numeroGuia: string | null
    mensajero: string | null
    guiaUrl: string | null
}

interface Ciudad {
    nombre: string
    departamento: string
}

interface Empresa {
    nombre: string
}

interface Agencia {
    id: number
    name: string
}

interface TipoAnexo {
    id: number
    name: string
}

interface CorrespondenciaClientProps {
    entrantes: any[]
    ciudades: Ciudad[]
    empresas: Empresa[]
    agencias: Agencia[]
    tiposAnexo: TipoAnexo[]
    canCreate?: boolean
}

export default function EntranteClient({
    entrantes,
    ciudades,
    empresas,
    agencias,
    tiposAnexo,
    canCreate = false,
}: CorrespondenciaClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isPending, startTransition] = useTransition()

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedMail, setSelectedMail] = useState<Mail | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const ciudadOptions = ciudades.map(c => ({
        value: `${c.nombre} - ${c.departamento}`,
        label: `${c.nombre} - ${c.departamento}`
    }))

    const empresaOptions = empresas.map(e => ({
        value: e.nombre,
        label: e.nombre
    }))

    const filteredList = entrantes.filter((mail) => {
        const query = searchQuery.toLowerCase()
        return (
            (mail.consecutive || "").toLowerCase().includes(query) ||
            (mail.remitenteNombre || "").toLowerCase().includes(query) ||
            (mail.asunto || "").toLowerCase().includes(query) ||
            (mail.agencia?.name || "").toLowerCase().includes(query)
        )
    })

    const handleOpenModal = (mail: Mail) => {
        setSelectedMail(mail)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setSelectedMail(null)
        setIsModalOpen(false)
    }

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex p-1 bg-gray-100 rounded-xl w-full md:w-auto">
                    <div className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-blue-600 shadow-sm">
                        <Inbox className="w-4 h-4" />
                        Entrante Pendiente ({entrantes.length})
                    </div>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por consecut., persona o asunto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                </div>
                
                {canCreate && (
                    <Button
                        onClick={() => { setSelectedMail(null); setIsModalOpen(true); }}
                        className="w-full md:w-auto font-semibold flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Entrante
                    </Button>
                )}
            </div>

            {/* List Table */}
            <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                    {filteredList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-base font-medium">No se encontraron correspondencias pendientes</p>
                            <p className="text-xs mt-1 text-gray-500">Intente con otro filtro o registre nuevos documentos</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                                        <tr>
                                            <th className="py-4 px-4 w-24">Consecutivo</th>
                                            <th className="py-4 px-4">Fecha</th>
                                            <th className="py-4 px-4">Remitente / Empresa</th>
                                            <th className="py-4 px-4">Asunto</th>
                                            <th className="py-4 px-4">Agencia Destino</th>
                                            <th className="py-4 px-4 w-28">Importancia</th>
                                            <th className="py-4 px-4 w-24 text-center">Acciones</th>
                                        </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredList.map((mail) => (
                                        <tr key={mail.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-4 font-mono text-xs font-semibold text-gray-700">
                                                {mail.consecutive || `ID: ${mail.id}`}
                                            </td>
                                            <td className="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">
                                                {format(new Date(mail.fechaRecepcion), "dd 'de' MMM, HH:mm", { locale: es })}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="font-semibold text-gray-900">{mail.remitenteNombre || "—"}</div>
                                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                    {mail.remitenteCiudad && (
                                                        <>
                                                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                                                            <span>{mail.remitenteCiudad}</span>
                                                        </>
                                                    )}
                                                    {mail.empresaMensajeria && (
                                                        <>
                                                            {mail.remitenteCiudad && <span className="text-gray-300">•</span>}
                                                            <Truck className="w-3 h-3 text-gray-400 shrink-0" />
                                                            <span>{mail.empresaMensajeria}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 max-w-[280px]">
                                                <p className="text-gray-700 line-clamp-2 text-xs">{mail.asunto}</p>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    {mail.agencia?.name || "—"}
                                                </span>
                                            </td>
                                            {mail.tipo === "ENTRANTE" ? (
                                                <td className="py-4 px-4 whitespace-nowrap space-y-1">
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {mail.importancia === "ALTA" ? (
                                                            <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0.5 px-2">Alta</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[10px] text-gray-600 bg-gray-100 uppercase font-semibold py-0.5 px-2">Normal</Badge>
                                                        )}
                                                        {mail.necesitaRespuesta && (
                                                            <Badge className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 font-semibold py-0.5 px-2">Requiere Rpta</Badge>
                                                        )}
                                                    </div>
                                                </td>
                                            ) : (
                                                <td className="py-4 px-4 text-xs space-y-1 max-w-[200px]">
                                                    {(!mail.numeroGuia && !mail.empresaMensajeria && !mail.mensajero) ? (
                                                        <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg font-medium inline-block text-[11px]">
                                                            Falta datos envío
                                                        </span>
                                                    ) : (
                                                        <div className="space-y-1 text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-2">
                                                            {mail.empresaMensajeria && (
                                                                <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-gray-400" /> <span className="font-semibold">{mail.empresaMensajeria}</span></p>
                                                            )}
                                                            {mail.numeroGuia && (
                                                                <p className="flex items-center gap-1.5 font-mono text-[10px]"><FileText className="w-3.5 h-3.5 text-gray-400" /> Guía: <span className="font-bold">{mail.numeroGuia}</span></p>
                                                            )}
                                                            {mail.mensajero && (
                                                                <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" /> Mensajero: <span className="font-semibold">{mail.mensajero}</span></p>
                                                            )}
                                                            {mail.guiaUrl && (
                                                                <a 
                                                                    href={mail.guiaUrl} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 mt-1 cursor-pointer"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" /> Ver Guía Adjunta
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="py-4 px-4 text-center">
                                                {canCreate ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenModal(mail)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border-gray-200 text-gray-700 hover:bg-slate-50 transition-all text-xs"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                        Completar
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Modal Dialog */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-5 flex items-center justify-between text-white bg-gradient-to-r from-blue-600 to-indigo-500">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                    <Inbox className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">
                                        {selectedMail ? "Editar Correspondencia Entrante" : "Registrar Correspondencia Entrante"}
                                    </h3>
                                    <p className="text-white/80 text-xs font-medium mt-0.5">{selectedMail ? `Consecutivo: ${selectedMail.consecutive || selectedMail.id}` : "Complete los datos del documento"}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <IncomingMailForm 
                                        initialData={selectedMail}
                                        agencias={agencias} 
                                        tiposAnexo={tiposAnexo} 
                                        ciudades={ciudades} 
                                        empresas={empresas} 
                                        onSuccess={() => {
                                            handleCloseModal();
                                            router.refresh();
                                        }}
                                    />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
